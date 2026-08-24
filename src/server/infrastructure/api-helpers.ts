// API helpers — request ID extraction, rate limiting, idempotency, session
// resolution. Used by every route handler.

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS, type RateLimitResult } from "./rate-limiter";
import { idempotencyStore } from "./idempotency";
import { newRequestContext, type RequestContext } from "./request-context";
import { container } from "../application/container";
import { finishRequest, logger, startRequest, traceIdFor } from "./logger";

export interface ApiContext {
  ctx: RequestContext;
}

function sameOrigin(req: NextRequest): boolean {
  const expected = req.nextUrl.origin;
  const origin = req.headers.get("origin");
  if (origin) {
    try { return origin !== "null" && new URL(origin).origin === expected; } catch { return false; }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin === expected; } catch { return false; }
  }

  // Server-to-server calls generally omit browser navigation headers.
  return true;
}

// Extract request id (from header or generate), resolve/create session, apply
// rate limiting. Returns either a context or a NextResponse (error).
export async function prepareApiContext(
  req: NextRequest,
  rateLimitName: keyof typeof RATE_LIMITS = "general"
): Promise<{ ctx: RequestContext } | { error: NextResponse }> {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const suppliedTraceId = req.headers.get("x-trace-id")?.trim();
  const traceId = suppliedTraceId && /^[A-Za-z0-9._:-]{8,200}$/.test(suppliedTraceId) ? suppliedTraceId : crypto.randomUUID();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !sameOrigin(req)) {
    logger.warn("http.request_rejected", { requestId, method: req.method, path: req.nextUrl.pathname, reason: "csrf_failed" });
    return {
      error: NextResponse.json(
        { ok: false, reason: "csrf_failed" },
        { status: 403, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
      ),
    };
  }

  // session: from header or cookie (lightweight — no NextAuth for prototype)
  let sessionId = req.headers.get("x-outrank-session") || undefined;
  let session = sessionId ? await container.repos.session.findById(sessionId) : null;
  if (!session) {
    session = await container.repos.session.create();
    sessionId = session.id;
  }

  // A session is intentionally created for anonymous visitors, so using it
  // as the only key lets a caller rotate sessions and bypass write limits.
  // Prefer the network identifier for abuse-sensitive routes and retain the
  // session as a secondary dimension for callers without an address.
  const identifier = ip ? `${rateLimitName}:ip:${ip}` : `${rateLimitName}:session:${sessionId || "anon"}`;
  const rl = await rateLimit(identifier, RATE_LIMITS[rateLimitName]);
  if (!rl.ok) {
    logger.warn("http.request_rejected", { requestId, method: req.method, path: req.nextUrl.pathname, reason: "rate_limited" });
    return {
      error: NextResponse.json(
        { ok: false, reason: "rate_limited", retryAfterMs: rl.retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)), "X-Request-Id": requestId } }
      ),
    };
  }

  const ctx = newRequestContext({ requestId, traceId, actor: sessionId, session: sessionId, ip, startedAt: Date.now() });
  startRequest({ requestId, method: req.method, path: req.nextUrl.pathname, sessionId, traceId });
  return { ctx };
}

// Idempotency wrapper — if the client sends Idempotency-Key, cache the response.
export async function withIdempotency<T>(
  req: NextRequest,
  fn: () => Promise<T>
): Promise<{ value: T; cached: boolean } | { error: NextResponse }> {
  const key = req.headers.get("idempotency-key")?.trim();
  if (!key) {
    return { value: await fn(), cached: false };
  }
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(key)) {
    return { error: NextResponse.json({ ok: false, reason: "invalid_idempotency_key" }, { status: 400 }) };
  }
  const inflight = idempotencyInFlight.get(key) as Promise<T> | undefined;
  if (inflight) return { value: await inflight, cached: true };
  const existing = await idempotencyStore.get<T>(key);
  if (existing) {
    return { value: existing.value, cached: true };
  }
  const pending = fn();
  idempotencyInFlight.set(key, pending);
  try {
    const value = await pending;
    await idempotencyStore.set(key, value, 24 * 3600 * 1000);
    return { value, cached: false };
  } finally {
    idempotencyInFlight.delete(key);
  }
}

const idempotencyInFlight = new Map<string, Promise<unknown>>();

// standard JSON response with request id + session id headers
export function jsonResponse(body: unknown, status = 200, init?: { sessionId?: string; requestId?: string }) {
  const traceId = init?.requestId ? traceIdFor(init.requestId) : undefined;
  if (init?.requestId) finishRequest(init.requestId, status);
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Request-Id": init?.requestId || crypto.randomUUID(),
      ...(traceId ? { "X-Trace-Id": traceId } : {}),
      ...(init?.sessionId ? { "X-Outrank-Session": init.sessionId } : {}),
      "Cache-Control": "no-store",
    },
  });
}

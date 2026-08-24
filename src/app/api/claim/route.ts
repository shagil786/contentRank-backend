// POST /api/claim — submit an entity ownership claim for moderation.
// Accepts { entityId: string, name: string, email: string, proofUrl?: string },
// validates the shape, persists a ModerationAction, and writes an audit record.

import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse } from "@/server/infrastructure/api-helpers";
import { container } from "@/server/application/container";
import { audit } from "@/server/infrastructure/request-context";
import { plainText } from "@/server/infrastructure/text";

export const dynamic = "force-dynamic";

// Same regex the EntityClaim client uses — kept in sync intentionally.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

interface ClaimBody {
  entityId?: unknown;
  name?: unknown;
  email?: unknown;
  proofUrl?: unknown;
}

export async function POST(req: NextRequest) {
  const prepared = await prepareApiContext(req, "claim");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  let body: ClaimBody;
  try {
    body = (await req.json()) as ClaimBody;
  } catch {
    return jsonResponse(
      { ok: false, reason: "bad_json" },
      400,
      { requestId: ctx.requestId, sessionId: ctx.session }
    );
  }

  const entityId = typeof body.entityId === "string" ? body.entityId.trim() : "";
  const name = typeof body.name === "string" ? plainText(body.name, 160) : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  // proofUrl is optional — normalize empty/whitespace to undefined.
  const proofUrlRaw = typeof body.proofUrl === "string" ? body.proofUrl.trim() : "";
  const proofUrl = proofUrlRaw || undefined;

  if (!entityId) {
    return jsonResponse(
      { ok: false, reason: "no_entity_id" },
      400,
      { requestId: ctx.requestId, sessionId: ctx.session }
    );
  }
  if (!name) {
    return jsonResponse(
      { ok: false, reason: "no_name" },
      400,
      { requestId: ctx.requestId, sessionId: ctx.session }
    );
  }
  if (!email) {
    return jsonResponse(
      { ok: false, reason: "no_email" },
      400,
      { requestId: ctx.requestId, sessionId: ctx.session }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse(
      { ok: false, reason: "invalid_email" },
      400,
      { requestId: ctx.requestId, sessionId: ctx.session }
    );
  }
  if (proofUrl && !URL_RE.test(proofUrl)) {
    return jsonResponse(
      { ok: false, reason: "invalid_proof_url" },
      400,
      { requestId: ctx.requestId, sessionId: ctx.session }
    );
  }

  const content = await container.repos.content.findById(entityId);
  if (!content) {
    return jsonResponse({ ok: false, reason: "entity_not_found" }, 404, {
      requestId: ctx.requestId,
      sessionId: ctx.session,
    });
  }

  const moderation = await container.repos.moderation.insert({
    contentId: entityId,
    action: "claim",
    reason: JSON.stringify({ name, email, proofUrl: proofUrl || null }),
    status: "open",
    session: ctx.session,
  });
  await audit(ctx, "claim.submit", "moderation", moderation.id, {
    contentId: entityId,
    proofProvided: Boolean(proofUrl),
  });

  return jsonResponse(
    { ok: true, moderationId: moderation.id },
    200,
    { requestId: ctx.requestId, sessionId: ctx.session }
  );
}

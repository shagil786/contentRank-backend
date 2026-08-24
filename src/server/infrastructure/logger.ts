type LogLevel = "info" | "warn" | "error";
import { recordHttpRequest } from "./metrics";
const requestStarts = new Map<string, { method: string; path: string; startedAt: number; sessionId?: string; traceId?: string }>();

function write(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const entry = { ts: new Date().toISOString(), level, service: "outrank-web", event, ...fields };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};

export function startRequest(input: { requestId: string; method: string; path: string; sessionId?: string; traceId?: string }) {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [requestId, started] of requestStarts) {
    if (started.startedAt < cutoff) requestStarts.delete(requestId);
  }
  requestStarts.set(input.requestId, { ...input, startedAt: Date.now() });
}

export function traceIdFor(requestId: string) {
  return requestStarts.get(requestId)?.traceId;
}

export function finishRequest(requestId: string, status: number) {
  const started = requestStarts.get(requestId);
  if (!started) return;
  requestStarts.delete(requestId);
  recordHttpRequest(started.path, status, Date.now() - started.startedAt);
  logger.info("http.request", {
    requestId,
    traceId: started.traceId,
    method: started.method,
    path: started.path,
    status,
    durationMs: Date.now() - started.startedAt,
    sessionId: started.sessionId,
  });
}

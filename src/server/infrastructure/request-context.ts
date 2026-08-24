// Request context — request ID, actor, audit. Threaded through application services
// so every write can be attributed and audited.

import { randomUUID } from "crypto";
import { auditRepo } from "../repositories/prisma-impl";
import type { AuditLog } from "../domain/types";
import { logger } from "./logger";

export interface RequestContext {
  requestId: string;
  traceId: string;
  actor: string;        // session id | "system" | "worker:<name>"
  session?: string;     // session id if authenticated
  ip?: string;
  startedAt: number;
}

export function newRequestContext(init?: Partial<RequestContext>): RequestContext {
  return {
    requestId: init?.requestId || randomUUID(),
    traceId: init?.traceId || randomUUID(),
    actor: init?.actor || "anon",
    session: init?.session,
    ip: init?.ip,
    startedAt: init?.startedAt || Date.now(),
  };
}

// Audit logger — every payment, bid, moderation action, ranking change goes here.
export async function audit(
  ctx: RequestContext,
  action: AuditLog["action"],
  targetType: AuditLog["targetType"],
  targetId: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await auditRepo.insert({
      actor: ctx.actor,
      action,
      targetType,
      targetId,
      payload: JSON.stringify(payload),
      requestId: ctx.requestId,
    });
  } catch (e) {
    // audit must never break the primary flow
    logger.error("audit.write_failed", { requestId: ctx.requestId, error: e instanceof Error ? e.message : String(e) });
  }
}

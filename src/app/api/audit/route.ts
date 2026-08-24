// GET /api/audit — recent audit log entries (admin/transparency).
import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse } from "@/server/infrastructure/api-helpers";
import { container } from "@/server/application/container";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const prepared = await prepareApiContext(req, "general");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;
  const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10));
  const entries = await container.repos.audit.recent(limit);
  return jsonResponse({ entries }, 200, { requestId: ctx.requestId, sessionId: ctx.session });
}

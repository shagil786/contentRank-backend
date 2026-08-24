// POST /api/boosts — apply an organic hype boost.
// Enforces daily allocation, writes to PostgreSQL + audit.
import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse, withIdempotency } from "@/server/infrastructure/api-helpers";
import { createOrganicBoost } from "@/server/application/create-organic-boost";
import { organicBoostSchema } from "@/server/schemas/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const prepared = await prepareApiContext(req, "boost");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "bad_json" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const parsed = organicBoostSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, reason: "validation", errors: parsed.error.flatten() }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const result = await withIdempotency(req, () => createOrganicBoost(parsed.data, ctx));
  if ("error" in result) return result.error;

  return jsonResponse(result.value, result.value.ok ? 200 : 400, { requestId: ctx.requestId, sessionId: ctx.session });
}

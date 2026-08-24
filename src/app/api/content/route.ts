// POST /api/content — submit new content to the board.
// Flow: URL → platform adapter → canonical identity → moderation → PostgreSQL → metric job → ranking.
import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse, withIdempotency } from "@/server/infrastructure/api-helpers";
import { submitContent } from "@/server/application/submit-content";
import { submitContentSchema } from "@/server/schemas/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const prepared = await prepareApiContext(req, "submit");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "bad_json" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const parsed = submitContentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, reason: "validation", errors: parsed.error.flatten() }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const result = await withIdempotency(req, () => submitContent(parsed.data, ctx));
  if ("error" in result) return result.error;

  return jsonResponse(result.value, result.value.ok ? 200 : 400, { requestId: ctx.requestId, sessionId: ctx.session });
}

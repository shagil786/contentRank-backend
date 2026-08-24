// POST /api/moderation — report content for review.
import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse } from "@/server/infrastructure/api-helpers";
import { reportContent } from "@/server/application/report-content";
import { reportContentSchema } from "@/server/schemas/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const prepared = await prepareApiContext(req, "general");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "bad_json" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const parsed = reportContentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, reason: "validation", errors: parsed.error.flatten() }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const result = await reportContent(parsed.data, ctx);
  return jsonResponse(result, result.ok ? 200 : 400, { requestId: ctx.requestId, sessionId: ctx.session });
}

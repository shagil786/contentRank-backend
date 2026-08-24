// POST /api/webhooks/dodo — Dodo payment webhook.
// Flow: signature verification → event deduplication → payment settlement
//   → sponsored ranking update → audit record.
import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse } from "@/server/infrastructure/api-helpers";
import { confirmPayment } from "@/server/application/confirm-payment";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const prepared = await prepareApiContext(req, "webhook");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  const rawBody = await req.text();
  const signature = req.headers.get("x-dodo-signature");

  const result = await confirmPayment({ rawBody, signature }, ctx);

  const status = result.ok
    ? 200
    : result.reason === "webhook_secret_not_configured"
      ? 503
      : ["missing_signature", "bad_signature"].includes(result.reason || "")
        ? 401
        : 400;
  return jsonResponse(result, status, { requestId: ctx.requestId });
}

// POST /api/bids/checkout — create a sponsored bid + initiate Dodo payment.
// Returns a checkout URL. The bid is "pending" until the webhook settles it.
import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse, withIdempotency } from "@/server/infrastructure/api-helpers";
import { createSponsoredBid } from "@/server/application/create-sponsored-bid";
import { sponsoredBidSchema } from "@/server/schemas/api";

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

  const parsed = sponsoredBidSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, reason: "validation", errors: parsed.error.flatten() }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const clientKey = req.headers.get("idempotency-key")?.trim();
  const result = await withIdempotency(req, () => createSponsoredBid({ ...parsed.data, idempotencyKey: clientKey }, ctx));
  if ("error" in result) return result.error;

  return jsonResponse(result.value, result.value.ok ? 200 : 400, { requestId: ctx.requestId, sessionId: ctx.session });
}

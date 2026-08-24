// CreateSponsoredBidService — creates a sponsored bid + initiates payment via
// PaymentProvider (Dodo). The bid is "pending" until the webhook settles it.
// Sponsored rankings are SEPARATE from organic — they never pollute the
// organic leaderboard.

import { container } from "./container";
import { audit } from "../infrastructure/request-context";
import type { RequestContext } from "../infrastructure/request-context";
import { randomUUID } from "crypto";

export interface CreateBidInput {
  contentId: string;
  amount: number;       // cents
  currency?: string;
  targetRank?: number;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
}

export interface CreateBidResult {
  ok: boolean;
  bidId?: string;
  paymentId?: string;
  checkoutUrl?: string;
  reason?: string;
}

export async function createSponsoredBid(
  input: CreateBidInput,
  ctx: RequestContext
): Promise<CreateBidResult> {
  const { repos, adapters } = container;

  const content = await repos.content.findById(input.contentId);
  if (!content) {
    return { ok: false, reason: "no_content" };
  }

  if (input.amount < 100) {
    return { ok: false, reason: "min_1_usd" };
  }

  // Prefer the client key so retries remain deduplicated across processes.
  const idempotencyKey = input.idempotencyKey || `${ctx.requestId}:${input.contentId}:${input.amount}`;
  const existingBid = await repos.ranking.findBidByIdempotencyKey(idempotencyKey);
  if (existingBid) {
    const existingPayment = existingBid.paymentId ? await repos.payment.findById(existingBid.paymentId) : null;
    return {
      ok: true,
      bidId: existingBid.id,
      paymentId: existingPayment?.id,
      checkoutUrl: existingPayment ? `/checkout?payment=${existingPayment.id}&bid=${existingBid.id}&amount=${existingBid.amount}` : undefined,
    };
  }

  // create the bid (pending)
  const bid = await repos.ranking.appendBid({
    contentId: input.contentId,
    amount: input.amount,
    currency: input.currency || "usd",
    status: "pending",
    idempotencyKey,
    session: ctx.session,
    targetRank: input.targetRank,
  });

  // initiate payment via Dodo
  const checkout = await adapters.payments.dodo.createCheckout({
    amount: input.amount,
    currency: input.currency || "usd",
    contentId: input.contentId,
    bidId: bid.id,
    idempotencyKey,
    successUrl: input.successUrl || "/?bid=success",
    cancelUrl: input.cancelUrl || "/?bid=cancel",
    description: `OUTRANK sponsored bid — ${content.title}`,
  });

  // link bid → payment
  await repos.ranking.updateBidStatus(bid.id, "pending", checkout.paymentId);

  await audit(ctx, "bid.create", "bid", bid.id, {
    contentId: input.contentId, amount: input.amount, currency: input.currency || "usd",
    bidId: bid.id, paymentId: checkout.paymentId, targetRank: input.targetRank,
  });

  return {
    ok: true,
    bidId: bid.id,
    paymentId: checkout.paymentId,
    checkoutUrl: checkout.checkoutUrl,
  };
}

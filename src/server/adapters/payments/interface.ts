// PaymentProvider interface. Payments are accessed ONLY through this.
// Dodo is one implementation. Stripe/Razorpay/etc. would be another.

export interface CreateCheckoutInput {
  amount: number;          // cents
  currency: string;        // "usd"
  contentId: string;       // what the bid is for
  bidId: string;           // the SponsoredBid id
  idempotencyKey: string;  // replay protection
  successUrl: string;
  cancelUrl: string;
  description: string;
}

export interface CreateCheckoutResult {
  paymentId: string;       // internal payment id
  checkoutUrl: string;     // redirect the user here
  providerPaymentId?: string;
}

export interface WebhookPayload {
  providerPaymentId: string;
  event_id: string;        // for dedup
  status: "succeeded" | "failed" | "refunded";
  amount: number;
  currency: string;
  raw: Record<string, unknown>;
}

export interface WebhookVerification {
  ok: boolean;
  payload: WebhookPayload | null;
  reason?: string;
}

export interface PaymentProvider {
  readonly name: "dodo" | "stripe" | "stub";
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookVerification>;
}

import { createHash, createHmac, randomBytes } from "crypto";

export function createSubscriptionToken() {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: createHash("sha256").update(raw).digest("hex") };
}

export function hashSubscriptionToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function stableUnsubscribeToken(scopeKey: string) {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.RESEND_API_KEY || "outrank-local-unsubscribe-secret";
  const raw = createHmac("sha256", secret).update(scopeKey).digest("hex");
  return { raw, hash: hashSubscriptionToken(raw) };
}

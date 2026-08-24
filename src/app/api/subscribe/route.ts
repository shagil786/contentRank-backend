// POST /api/subscribe — email subscription for leaderboard notifications.
// Accepts { email, entityId?, entityName? }. When entityId is present, the
// user subscribes to THAT entity's rank changes only. Otherwise, global.
// Subscriptions are persisted and deduplicated by email + scope. Confirmation
// delivery remains a separate notification integration.

import { NextRequest } from "next/server";
import { prepareApiContext, jsonResponse } from "@/server/infrastructure/api-helpers";
import { audit } from "@/server/infrastructure/request-context";
import { container } from "@/server/application/container";
import { createSubscriptionToken, stableUnsubscribeToken } from "@/server/infrastructure/subscription-tokens";
import { sendResendEmail } from "@/server/infrastructure/email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const prepared = await prepareApiContext(req, "subscribe");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "bad_json" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const b = body as { email?: string; entityId?: string; entityName?: string };
  const email = typeof b.email === "string" ? b.email.trim() : "";

  if (!email) {
    return jsonResponse({ ok: false, reason: "no_email" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ ok: false, reason: "invalid_email" }, 400, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  const entityId = typeof b.entityId === "string" && b.entityId.trim() ? b.entityId.trim() : undefined;
  if (entityId && !(await container.repos.content.findById(entityId))) {
    return jsonResponse({ ok: false, reason: "entity_not_found" }, 404, { requestId: ctx.requestId, sessionId: ctx.session });
  }
  const scopeKey = entityId ? `entity:${entityId}:${email.toLowerCase()}` : `global:${email.toLowerCase()}`;
  const confirmation = createSubscriptionToken();
  const unsubscribe = stableUnsubscribeToken(scopeKey);
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const subscription = await container.repos.subscription.upsert({
    email: email.toLowerCase(), entityId, scopeKey, session: ctx.session,
    confirmationTokenHash: confirmation.hash,
    confirmationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    unsubscribeTokenHash: unsubscribe.hash,
  });

  const confirmUrl = `${appUrl}/api/subscribe/confirm?token=${confirmation.raw}`;
  const unsubscribeUrl = `${appUrl}/api/subscribe/unsubscribe?token=${unsubscribe.raw}`;
  let emailDelivery: "sent" | "not_configured" = "not_configured";
  try {
    emailDelivery = await sendResendEmail({
      to: email,
      subject: "Confirm your OUTRANK notifications",
      text: `Confirm your subscription: ${confirmUrl}\n\nUnsubscribe anytime: ${unsubscribeUrl}`,
      html: `<p>Confirm your OUTRANK notifications:</p><p><a href="${confirmUrl}">Confirm subscription</a></p><p><a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
    });
  } catch {
    return jsonResponse({ ok: false, reason: "email_delivery_failed", subscriptionId: subscription.id }, 503, { requestId: ctx.requestId, sessionId: ctx.session });
  }

  // audit the subscription (entity-specific or global)
  await audit(ctx, "subscribe", "content", entityId || "global", {
    email,
    entityId: entityId || null,
    entityName: b.entityName || null,
    scope: entityId ? "entity" : "global",
  });

  return jsonResponse({ ok: true, subscriptionId: subscription.id, scope: entityId ? "entity" : "global", confirmationRequired: true, emailDelivery }, 200, { requestId: ctx.requestId, sessionId: ctx.session });
}

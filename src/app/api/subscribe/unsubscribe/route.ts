import { NextRequest, NextResponse } from "next/server";
import { container } from "@/server/application/container";
import { hashSubscriptionToken } from "@/server/infrastructure/subscription-tokens";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ ok: false, reason: "invalid_token" }, { status: 400 });
  const removed = await container.repos.subscription.deleteByUnsubscribeTokenHash(hashSubscriptionToken(token));
  if (!removed) return NextResponse.json({ ok: false, reason: "token_invalid" }, { status: 404 });
  return NextResponse.json({ ok: true, unsubscribed: true });
}

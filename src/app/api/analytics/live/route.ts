// GET /api/analytics/live — returns real-time visitor stats.
// This is the server's own count (not Google Analytics). In production you'd
// also add Google Analytics (gtag) client-side for full analytics, and optionally
// sync GA's real-time count here.
import { NextRequest, NextResponse } from "next/server";
import { liveTracker } from "@/server/infrastructure/live-tracker";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const stats = liveTracker.getStats();
  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}

// POST to record a page view (called client-side on mount)
export async function POST(req: NextRequest) {
  liveTracker.pageView();
  liveTracker.visitorEnter();
  const stats = liveTracker.getStats();
  return NextResponse.json({ ok: true, ...stats }, { headers: { "Cache-Control": "no-store" } });
}

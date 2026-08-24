import { NextRequest, NextResponse } from "next/server";
import { fetchOpenGraph } from "@/lib/outrank/og";

export const dynamic = "force-dynamic";

// GET /api/og?url=<url>
// Server-side OpenGraph extraction. Used by the AddEntity form to auto-fill
// name/sub/blurb from a pasted link. Never called from the client SDK directly.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url.trim()) {
    return NextResponse.json({ ok: false, reason: "no_url" }, { status: 400 });
  }
  const result = await fetchOpenGraph(url);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

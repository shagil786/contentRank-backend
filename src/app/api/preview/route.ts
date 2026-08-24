import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/preview?id=<entityId>&amount=<n>
// Returns projected rank after a hypothetical boost, without committing.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const amount = parseInt(req.nextUrl.searchParams.get("amount") || "1", 10);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(
      `http://localhost:3004/preview?id=${encodeURIComponent(id)}&amount=${amount}`,
      { signal: ctrl.signal, cache: "no-store" }
    );
    clearTimeout(t);
    if (!res.ok) throw new Error("bad_status");
    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { newRank: null, prevRank: null, newScore: null, needed: null, error: "engine_unreachable" },
      { status: 200 }
    );
  }
}

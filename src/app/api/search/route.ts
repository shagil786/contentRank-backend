import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/search?q=<query>
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (!q) return NextResponse.json({ results: [] });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch("http://localhost:3004/state", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) throw new Error("bad_status");
    const data = await res.json();
    const ents: any[] = data.entities || [];
    const results = ents
      .filter((e) => e.name.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q) || e.category.includes(q) || e.kind.includes(q))
      .slice(0, 12)
      .map((e) => ({
        id: e.id,
        name: e.name,
        sub: e.sub,
        category: e.category,
        kind: e.kind,
        rank: e.rank,
        score: e.score,
        poster: e.poster,
      }));
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

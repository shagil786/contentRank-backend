import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/trending — fastest rising & falling across all entities
export async function GET() {
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
    const rising = [...ents]
      .filter((e) => e.momentum > 0)
      .sort((a, b) => b.momentum - a.momentum)
      .slice(0, 8)
      .map((e) => ({ id: e.id, name: e.name, category: e.category, rank: e.rank, momentum: e.momentum, score: e.score, poster: e.poster, sub: e.sub }));
    const falling = [...ents]
      .filter((e) => e.momentum < 0)
      .sort((a, b) => a.momentum - b.momentum)
      .slice(0, 8)
      .map((e) => ({ id: e.id, name: e.name, category: e.category, rank: e.rank, momentum: e.momentum, score: e.score, poster: e.poster, sub: e.sub }));
    return NextResponse.json({ rising, falling }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ rising: [], falling: [] });
  }
}

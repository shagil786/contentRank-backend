import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/entity/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    const entity = (data.entities || []).find(
      (e: { id: string; slug: string }) => e.id === id || e.slug === id
    );
    if (!entity) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(entity, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

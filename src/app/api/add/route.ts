import { NextRequest, NextResponse } from "next/server";
import type { AddEntityRequest } from "@/lib/outrank/types";

export const dynamic = "force-dynamic";

// POST /api/add — submit a new entity to the board
export async function POST(req: NextRequest) {
  let body: AddEntityRequest;
  try {
    body = (await req.json()) as AddEntityRequest;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, reason: "no_name" }, { status: 400 });
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch("http://localhost:3004/add", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    clearTimeout(t);
    if (!res.ok) throw new Error("bad_status");
    const data = await res.json();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, reason: "engine_unreachable" }, { status: 503 });
  }
}

// GET /api/leaderboard — canonical organic leaderboard from PostgreSQL (source of truth).
// Falls back to the realtime engine cache if PostgreSQL is empty (e.g. before seeding).
import { NextRequest, NextResponse } from "next/server";
import { prepareApiContext } from "@/server/infrastructure/api-helpers";
import { fetchLeaderboard } from "@/server/application/fetch-leaderboard";
import type { LeaderState, Entity, Category } from "@/lib/outrank/types";
import { captureServerError } from "@/server/infrastructure/error-tracker";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FALLBACK: LeaderState = {
  entities: [], activity: [], presence: 0, totalBoosts: 0, ts: Date.now(),
};

function pageParam(value: string | null, fallback: number, max: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback;
}

// map a Content+ranking row from PostgreSQL into the Entity shape the frontend expects
function toEntity(entry: {
  content: any; rank: number; score: number; momentum: number; prevRank: number; peakRank: number; history: any[];
}): Entity {
  const c = entry.content;
  return {
    id: c.id,
    slug: c.id,
    name: c.title.toUpperCase(),
    category: c.category,
    kind: c.kind,
    sub: c.blurb || c.description || c.platform,
    blurb: c.description || c.blurb || "",
    link: c.url || undefined,
    image: c.imageUrl || undefined,
    score: entry.score,
    supporters: 0,
    prevRank: entry.prevRank,
    rank: entry.rank,
    peakRank: entry.peakRank,
    momentum: entry.momentum,
    history: entry.history.length ? entry.history : [{ t: Date.now(), rank: entry.rank, score: entry.score }],
    createdAt: new Date(c.createdAt).getTime(),
    poster: { hue: (c.title.charCodeAt(0) * 7) % 360, accent: "#ff3b1f", tag: String(c.kind).toUpperCase().slice(0, 4) },
  };
}

export async function GET(req: NextRequest) {
  const prepared = await prepareApiContext(req, "general");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  const category = (req.nextUrl.searchParams.get("category") || "global") as Category;
  const limit = pageParam(req.nextUrl.searchParams.get("limit"), 48, 48);
  const cursor = pageParam(req.nextUrl.searchParams.get("cursor"), 0, Number.MAX_SAFE_INTEGER);

  try {
    const view = await fetchLeaderboard(category, { limit, cursor });
    if (view.entries.length === 0) {
      // fall back to realtime engine cache
      try {
        const r = await fetch("http://localhost:3004/state", { cache: "no-store" });
        if (r.ok) {
          const data = (await r.json()) as LeaderState;
          return NextResponse.json({ ...data, entities: data.entities.slice(0, limit), nextCursor: undefined }, { headers: { "Cache-Control": "no-store", "X-Request-Id": ctx.requestId } });
        }
      } catch { /* ignore */ }
      return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "no-store", "X-Request-Id": ctx.requestId } });
    }
    const entities = view.entries.map(toEntity);
    return NextResponse.json(
      { entities, activity: [], presence: 0, totalBoosts: view.totalBoosts, ts: Date.now(), nextCursor: view.nextCursor, total: view.total } as LeaderState,
      { headers: { "Cache-Control": "no-store", "X-Request-Id": ctx.requestId } }
    );
  } catch (e) {
    captureServerError("leaderboard.fetch_failed", e, { requestId: ctx.requestId, path: req.nextUrl.pathname });
    return NextResponse.json(FALLBACK, { headers: { "Cache-Control": "no-store", "X-Request-Id": ctx.requestId } });
  }
}

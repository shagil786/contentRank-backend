// FetchLeaderboardService — reads the organic ranking (source of truth = latest
// OrganicRanking snapshots in PostgreSQL). The realtime mini-service caches this
// in memory for speed; this service is the canonical read.

import { container } from "./container";
import type { Category, Content, OrganicRanking } from "../domain/types";

export interface LeaderboardEntry {
  content: Content;
  rank: number;
  score: number;
  momentum: number;
  prevRank: number;
  peakRank: number;
  history: { t: number; rank: number; score: number }[];
}

export interface LeaderboardView {
  entries: LeaderboardEntry[];
  category: Category;
  totalBoosts: number;
  presence: number;
  ts: number;
  nextCursor?: string;
  total: number;
}

export async function fetchLeaderboard(category: Category = "global", options: { limit?: number; cursor?: number } = {}): Promise<LeaderboardView> {
  const { repos } = container;
  const limit = Math.min(48, Math.max(1, options.limit ?? 48));
  const cursor = Math.max(0, options.cursor ?? 0);

  // get all live content
  const contents = await repos.content.listAll("live");
  // latest organic snapshots
  const snapshots = await repos.ranking.latestOrganicByCategory(category);

  // build a score map from snapshots (global scope = all snapshots; category scope = filtered)
  const scoreMap = new Map<string, { score: number; momentum: number }>();
  for (const s of snapshots) {
    scoreMap.set(s.contentId, { score: s.score, momentum: s.momentum });
  }

  // filter + sort
  const scoped = category === "global" ? contents : contents.filter(c => c.category === category);
  const ranked = scoped
    .map(c => ({
      content: c,
      score: scoreMap.get(c.id)?.score ?? 0,
      momentum: scoreMap.get(c.id)?.momentum ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.content.createdAt.getTime() - b.content.createdAt.getTime());

  // Paginate before loading per-entity history so large boards do not hydrate
  // history for rows that will never be sent to the client.
  const entries: LeaderboardEntry[] = [];
  const page = ranked.slice(cursor, cursor + limit);
  for (let pageIndex = 0; pageIndex < page.length; pageIndex++) {
    const rank = cursor + pageIndex + 1;
    const r = page[pageIndex];
    const history = await repos.ranking.organicHistory(r.content.id, 24);
    const peakRank = history.length ? Math.min(...history.map(h => h.rank)) : rank;
    const prevRank = history.length >= 2 ? history[history.length - 2].rank : rank;
    entries.push({
      content: r.content,
      rank,
      score: r.score,
      momentum: r.momentum,
      prevRank,
      peakRank: peakRank === Infinity ? rank : peakRank,
      history: history.map(h => ({ t: h.snapshotAt.getTime(), rank: h.rank, score: h.score })),
    });
  }

  return {
    entries,
    category,
    totalBoosts: 0, // filled by realtime cache
    presence: 0,    // filled by realtime cache
    ts: Date.now(),
    nextCursor: cursor + limit < ranked.length ? String(cursor + limit) : undefined,
    total: ranked.length,
  };
}

// Full state for the realtime engine to hydrate from on boot.
export async function fetchFullState() {
  const { repos } = container;
  const contents = await repos.content.listAll("live");
  const allSnapshots: { contentId: string; score: number; momentum: number; category: string }[] = [];
  for (const c of contents) {
    const snaps = await repos.ranking.organicHistory(c.id, 24);
    const latest = snaps[snaps.length - 1];
    if (latest) allSnapshots.push({ contentId: c.id, score: latest.score, momentum: latest.momentum, category: c.category });
  }
  return { contents, snapshots: allSnapshots };
}

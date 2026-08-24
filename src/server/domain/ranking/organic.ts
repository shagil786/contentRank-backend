// Organic ranking service. Pure logic — no I/O.
// Organic rank = sum of organic boosts (hype) in the rolling window.
// This is SEPARATE from sponsored ranking.

import type { Content, OrganicRanking, Category } from "../types";

export interface OrganicScore {
  contentId: string;
  score: number;
  momentum: number;
}

// Compute organic scores from a list of (contentId, boostAmount) tuples.
// In production this reads from a materialized view / Redis sorted set.
export function computeOrganicScores(
  boosts: { contentId: string; amount: number; ts: number }[],
  windowMs: number,
  now: number = Date.now()
): Map<string, OrganicScore> {
  const scores = new Map<string, { score: number; recent: number[]; prevRank: number }>();

  for (const b of boosts) {
    if (now - b.ts > windowMs) continue;
    const cur = scores.get(b.contentId) || { score: 0, recent: [], prevRank: 0 };
    cur.score += b.amount;
    cur.recent.push(b.ts);
    scores.set(b.contentId, cur);
  }

  const result = new Map<string, OrganicScore>();
  for (const [cid, v] of scores) {
    // momentum = activity in last 6h vs previous 18h (rough)
    const sixH = 6 * 3600_000;
    const recent = v.recent.filter(t => now - t < sixH).length;
    const older = v.recent.filter(t => now - t >= sixH).length;
    result.set(cid, { contentId: cid, score: v.score, momentum: recent - older });
  }
  return result;
}

// Rank contents by score desc, createdAt asc (older wins ties — deterministic).
export function rankByScore<T extends { contentId: string; score: number }>(
  scores: T[],
  contents: Content[]
): { contentId: string; rank: number; score: number }[] {
  const createdMap = new Map(contents.map(c => [c.id, c.createdAt.getTime()]));
  const sorted = [...scores].sort((a, b) =>
    b.score - a.score || (createdMap.get(a.contentId) || 0) - (createdMap.get(b.contentId) || 0)
  );
  return sorted.map((s, i) => ({ contentId: s.contentId, rank: i + 1, score: s.score }));
}

// Rank within a category.
export function rankCategory(
  contents: Content[],
  scores: Map<string, OrganicScore>,
  category: Category
): { contentId: string; rank: number; score: number; momentum: number }[] {
  const filtered = category === "global"
    ? contents
    : contents.filter(c => c.category === category);
  const scoped = filtered
    .map(c => ({
      contentId: c.id,
      score: scores.get(c.id)?.score ?? 0,
      momentum: scores.get(c.id)?.momentum ?? 0,
    }));
  const ranked = rankByScore(scoped, filtered);
  return ranked.map(r => ({
    ...r,
    momentum: scores.get(r.contentId)?.momentum ?? 0,
  }));
}

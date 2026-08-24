// Sponsored ranking service. SEPARATE from organic.
// Sponsored rank = by settled bid amount (highest bid = best rank).
// Sponsored entries are visually distinct and never pollute organic rankings.

import type { Content, SponsoredBid } from "../types";

export interface SponsoredEntry {
  contentId: string;
  totalBid: number;     // sum of settled bids, in cents
  bidCount: number;
  rank: number;         // 1 = highest bidder
}

// Aggregate settled bids per content and rank.
export function computeSponsoredRanking(
  bids: SponsoredBid[],
  contents: Content[]
): SponsoredEntry[] {
  const totals = new Map<string, { totalBid: number; bidCount: number }>();
  for (const b of bids) {
    if (b.status !== "settled") continue;
    const cur = totals.get(b.contentId) || { totalBid: 0, bidCount: 0 };
    cur.totalBid += b.amount;
    cur.bidCount += 1;
    totals.set(b.contentId, cur);
  }
  const createdMap = new Map(contents.map(c => [c.id, c.createdAt.getTime()]));
  const entries = Array.from(totals.entries()).map(([contentId, v]) => ({
    contentId,
    totalBid: v.totalBid,
    bidCount: v.bidCount,
    rank: 0,
  }));
  entries.sort((a, b) =>
    b.totalBid - a.totalBid || (createdMap.get(a.contentId) || 0) - (createdMap.get(b.contentId) || 0)
  );
  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}

// What's the minimum additional bid to reach a target rank?
export function bidToReachRank(
  currentBids: SponsoredEntry[],
  contentId: string,
  targetRank: number
): { needed: number; currentlyAt: number | null } {
  const sorted = [...currentBids].sort((a, b) => a.rank - b.rank);
  if (targetRank < 1) return { needed: 0, currentlyAt: null };
  const myEntry = sorted.find(e => e.contentId === contentId);
  const myCurrent = myEntry?.totalBid ?? 0;
  if (targetRank > sorted.length) {
    return { needed: 1, currentlyAt: myEntry?.rank ?? null };
  }
  // to be at rank N, I need to beat the bid at rank N
  const target = sorted[targetRank - 1];
  const needed = Math.max(1, target.totalBid - myCurrent + 1);
  return { needed, currentlyAt: myEntry?.rank ?? null };
}

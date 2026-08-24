// CreateOrganicBoostService — applies a paid boost (USD, no daily limit).
// Writes to PostgreSQL (OrganicRanking snapshot + audit), returns the new rank.
// The realtime engine calls this.

import { container } from "./container";
import { audit } from "../infrastructure/request-context";
import type { RequestContext } from "../infrastructure/request-context";
import type { Category } from "../domain/types";

export interface OrganicBoostInput {
  contentId: string;
  amount: number;
}

export interface OrganicBoostResult {
  ok: boolean;
  contentId?: string;
  newRank?: number;
  prevRank?: number;
  newScore?: number;
  remaining?: number;
  reason?: string;
}

export async function createOrganicBoost(
  input: OrganicBoostInput,
  ctx: RequestContext
): Promise<OrganicBoostResult> {
  const { repos } = container;

  // No auth, no daily limit — paid model. Anyone can boost (they pay).
  const amount = Math.max(1, Math.floor(input.amount));

  const content = await repos.content.findById(input.contentId);
  if (!content) {
    return { ok: false, reason: "no_content" };
  }

  // current score (from latest snapshot)
  const history = await repos.ranking.organicHistory(content.id, 24);
  const latest = history[history.length - 1];
  const prevScore = latest?.score ?? 1000;
  const prevRank = latest?.rank ?? 9999;
  const newScore = prevScore + amount;

  // compute new rank within category (and global)
  const category = content.category as Category;
  const contents = await repos.content.listByCategory(category);
  const allContents = await repos.content.listAll();
  const catScores = new Map<string, number>();

  // read latest scores for all contents in category
  for (const c of contents) {
    if (c.id === content.id) { catScores.set(c.id, newScore); continue; }
    const h = await repos.ranking.organicHistory(c.id, 24);
    const l = h[h.length - 1];
    catScores.set(c.id, l?.score ?? 1000);
  }

  // rank within category
  const catRanked = contents
    .map(c => ({ id: c.id, score: catScores.get(c.id) ?? 0, created: c.createdAt.getTime() }))
    .sort((a, b) => b.score - a.score || a.created - b.created);
  const catRank = catRanked.findIndex(x => x.id === content.id) + 1;

  // global rank
  const globalScores = new Map<string, number>();
  for (const c of allContents) {
    if (c.id === content.id) { globalScores.set(c.id, newScore); continue; }
    if (catScores.has(c.id)) { globalScores.set(c.id, catScores.get(c.id)!); continue; }
    const h = await repos.ranking.organicHistory(c.id, 24);
    const l = h[h.length - 1];
    globalScores.set(c.id, l?.score ?? 1000);
  }
  const globalRanked = allContents
    .map(c => ({ id: c.id, score: globalScores.get(c.id) ?? 0, created: c.createdAt.getTime() }))
    .sort((a, b) => b.score - a.score || a.created - b.created);
  const globalRank = globalRanked.findIndex(x => x.id === content.id) + 1;

  const momentum = (latest?.momentum ?? 0) + (prevRank - globalRank);

  // persist snapshot (source of truth)
  await repos.ranking.appendOrganicSnapshot({
    contentId: content.id,
    category: "global",
    rank: globalRank,
    score: newScore,
    momentum,
  });
  await repos.ranking.appendOrganicSnapshot({
    contentId: content.id,
    category,
    rank: catRank,
    score: newScore,
    momentum,
  });

  // audit
  await audit(ctx, "boost.organic", "boost", content.id, {
    contentId: content.id,
    amount,
    prevRank,
    newRank: globalRank,
    prevScore, newScore,
  });

  return {
    ok: true,
    contentId: content.id,
    newRank: globalRank,
    prevRank,
    newScore,
  };
}

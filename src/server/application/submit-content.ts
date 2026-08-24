// SubmitContentService — content submission flow:
//   Public URL → URL registry → platform adapter → canonical content identity
//   → moderation checks → PostgreSQL → enqueue metric job → ranking calculation

import { container } from "./container";
import { audit } from "../infrastructure/request-context";
import { moderateContent } from "../domain/moderation/rules";
import { guessKindFromPlatform } from "../adapters/platforms/adapters";
import type { RequestContext } from "../infrastructure/request-context";
import type { Content, ContentKind, Category, Platform } from "../domain/types";
import { plainText } from "../infrastructure/text";

export interface SubmitContentInput {
  url?: string;              // optional — if absent, manual entry
  title: string;
  kind?: ContentKind;
  category?: Category;
  blurb?: string;
  sub?: string;              // context string (year/maker/platform)
}

export interface SubmitContentResult {
  ok: boolean;
  content?: Content;
  reason?: string;
  flags?: string[];
}

export async function submitContent(
  input: SubmitContentInput,
  ctx: RequestContext
): Promise<SubmitContentResult> {
  const { repos, adapters } = container;

  // 1. resolve canonical identity via platform adapter (or manual)
  let canonicalId: string;
  let platform: Platform;
  let platformKey: string;
  let url: string;
  let title = plainText(input.title, 200);
  const blurb = input.blurb ? plainText(input.blurb, 500) : undefined;
  let description: string | undefined;
  let imageUrl: string | undefined;
  let creatorHandle: string | undefined;
  let creatorName: string | undefined;

  if (input.url?.trim()) {
    url = input.url.trim();
    const adapter = adapters.resolvePlatformForUrl(url);
    if (!adapter) {
      return { ok: false, reason: "no_adapter" };
    }
    const resolved = await adapter.resolve(url);
    if (!resolved) {
      return { ok: false, reason: "resolve_failed" };
    }
    canonicalId = resolved.canonicalId;
    platform = resolved.platform;
    platformKey = resolved.platformKey;
    url = resolved.url;
    if (resolved.title) title = resolved.title;
    description = resolved.description;
    imageUrl = resolved.imageUrl;
    creatorHandle = resolved.creatorHandle;
    creatorName = resolved.creatorName;
  } else {
    // manual entry — no URL
    canonicalId = `manual:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    platform = "manual";
    platformKey = canonicalId;
    url = "";
  }

  // 2. URL registry — dedupe by canonical id
  const existing = await repos.content.findByCanonicalId(canonicalId);
  if (existing) {
    await audit(ctx, "content.submit.duplicate", "content", existing.id, { canonicalId, url });
    return { ok: true, content: existing, flags: ["duplicate"] };
  }

  // 3. moderation checks
  const verdict = moderateContent({ url, title, description });
  if (!verdict.allowed) {
    await audit(ctx, "content.submit.rejected", "content", canonicalId, { reason: verdict.reason, url, title });
    return { ok: false, reason: verdict.reason, flags: verdict.flags };
  }

  // 4. resolve kind/category (from input or platform guess)
  const guess = input.kind ? null : guessKindFromPlatform(platform);
  const kind = input.kind || guess?.kind || "topic";
  const category = input.category || guess?.category || "tech";

  // 5. upsert creator if we found one
  let creatorId: string | undefined;
  if (creatorHandle && platform !== "manual" && platform !== "web") {
    const existingCreator = await repos.creator.findByPlatformHandle(platform, creatorHandle);
    if (existingCreator) {
      creatorId = existingCreator.id;
    } else {
      const c = await repos.creator.upsert({ platform, handle: creatorHandle, displayName: creatorName || creatorHandle });
      creatorId = c.id;
    }
  }

  // 6. persist to PostgreSQL (source of truth)
  const content = await repos.content.insert({
    canonicalId,
    platform,
    platformKey,
    url,
    title,
    description,
    imageUrl,
    kind,
    category,
    blurb,
    creatorId,
    submittedBy: ctx.session,
    status: "live",
  });

  // 7. audit
  await audit(ctx, "content.submit", "content", content.id, {
    canonicalId, platform, kind, category, url, title, flags: verdict.flags,
  });

  // 8. enqueue metric job (background worker will fetch metrics via adapter)
  //    — in this prototype the worker polls; no queue needed.
  await repos.metric.append({
    contentId: content.id,
    source: "outrank",
    views: 0, likes: 0, comments: 0, shares: 0,
  });

  // 9. initial ranking snapshot (score 0)
  await repos.ranking.appendOrganicSnapshot({
    contentId: content.id,
    category,
    rank: 9999,
    score: 1000, // starter score so it appears on the board
    momentum: 0,
  });

  return { ok: true, content, flags: verdict.flags };
}

// Prisma implementations of the repository interfaces.
// This is the ONLY place that knows about Prisma. Swap this file for a
// Postgres-driver version and the rest of the backend is untouched.

import { db } from "@/lib/db";
import type {
  ContentRepository, CreatorRepository, MetricRepository,
  RankingRepository, PaymentRepository, ModerationRepository,
  AuditRepository, SessionRepository, SubscriptionRepository,
} from "./interfaces";
import type {
  Content, Creator, Metric, OrganicRanking, SponsoredBid,
  Payment, ModerationAction, AuditLog, Session,
  Subscription,
  Category, ContentStatus,
} from "../domain/types";

type PrContent = {
  id: string; canonicalId: string; platform: string; platformKey: string;
  url: string; title: string; description: string | null; imageUrl: string | null;
  kind: string; category: string; blurb: string | null; creatorId: string | null;
  submittedBy: string | null; status: string; createdAt: Date; updatedAt: Date;
};

const toContent = (p: PrContent): Content => ({
  id: p.id, canonicalId: p.canonicalId, platform: p.platform as Content["platform"],
  platformKey: p.platformKey, url: p.url, title: p.title,
  description: p.description ?? undefined, imageUrl: p.imageUrl ?? undefined,
  kind: p.kind as Content["kind"], category: p.category as Category,
  blurb: p.blurb ?? undefined, creatorId: p.creatorId ?? undefined,
  submittedBy: p.submittedBy ?? undefined, status: p.status as ContentStatus,
  createdAt: p.createdAt, updatedAt: p.updatedAt,
});

export const contentRepo: ContentRepository = {
  async findById(id) {
    const r = await db.content.findUnique({ where: { id } });
    return r ? toContent(r) : null;
  },
  async findByCanonicalId(canonicalId) {
    const r = await db.content.findUnique({ where: { canonicalId } });
    return r ? toContent(r) : null;
  },
  async findByUrl(url) {
    const r = await db.content.findFirst({ where: { url } });
    return r ? toContent(r) : null;
  },
  async listByCategory(category, status = "live") {
    const where = category === "global"
      ? { status }
      : { category, status };
    const rows = await db.content.findMany({ where, orderBy: { createdAt: "asc" } });
    return rows.map(toContent);
  },
  async listAll(status = "live") {
    const rows = await db.content.findMany({ where: { status }, orderBy: { createdAt: "asc" } });
    return rows.map(toContent);
  },
  async insert(c) {
    const r = await db.content.create({
      data: {
        canonicalId: c.canonicalId, platform: c.platform, platformKey: c.platformKey,
        url: c.url, title: c.title, description: c.description ?? null,
        imageUrl: c.imageUrl ?? null, kind: c.kind, category: c.category,
        blurb: c.blurb ?? null, creatorId: c.creatorId ?? null,
        submittedBy: c.submittedBy ?? null, status: c.status,
      },
    });
    return toContent(r);
  },
  async updateStatus(id, status) {
    await db.content.update({ where: { id }, data: { status } });
  },
  async update(id, patch) {
    const row = await db.content.update({
      where: { id },
      data: {
        title: patch.title ?? undefined,
        blurb: patch.blurb ?? undefined,
        url: patch.url ?? undefined,
      },
    });
    return toContent(row);
  },
};

export const creatorRepo: CreatorRepository = {
  async findById(id) {
    const r = await db.creator.findUnique({ where: { id } });
    return r ? { ...r } as Creator : null;
  },
  async findByPlatformHandle(platform, handle) {
    const r = await db.creator.findUnique({ where: { platform_handle: { platform, handle } } });
    return r ? { ...r } as Creator : null;
  },
  async upsert(c) {
    if (c.id) {
      const r = await db.creator.update({ where: { id: c.id }, data: { displayName: c.displayName, avatarUrl: c.avatarUrl ?? null } });
      return { ...r } as Creator;
    }
    const r = await db.creator.create({
      data: { platform: c.platform, handle: c.handle, displayName: c.displayName, avatarUrl: c.avatarUrl ?? null },
    });
    return { ...r } as Creator;
  },
};

export const metricRepo: MetricRepository = {
  async append(m) {
    const r = await db.metric.create({
      data: { contentId: m.contentId, source: m.source, views: m.views, likes: m.likes, comments: m.comments, shares: m.shares },
    });
    return { ...r } as Metric;
  },
  async latestForContent(contentId) {
    const r = await db.metric.findFirst({ where: { contentId }, orderBy: { fetchedAt: "desc" } });
    return r ? { ...r } as Metric : null;
  },
};

export const rankingRepo: RankingRepository = {
  async appendOrganicSnapshot(r) {
    const row = await db.organicRanking.create({
      data: { contentId: r.contentId, category: r.category, rank: r.rank, score: r.score, momentum: r.momentum },
    });
    return { ...row } as OrganicRanking;
  },
  async latestOrganicByCategory(category) {
    // latest snapshot per content within the category
    const rows = await db.organicRanking.findMany({
      where: { category },
      orderBy: [{ snapshotAt: "desc" }],
    });
    // dedupe by contentId keeping the latest
    const seen = new Set<string>();
    const out: OrganicRanking[] = [];
    for (const r of rows) {
      if (seen.has(r.contentId)) continue;
      seen.add(r.contentId);
      out.push({ ...r } as OrganicRanking);
    }
    return out;
  },
  async organicHistory(contentId, limit) {
    const rows = await db.organicRanking.findMany({
      where: { contentId }, orderBy: { snapshotAt: "desc" }, take: limit,
    });
    return rows.map(r => ({ ...r } as OrganicRanking)).reverse();
  },
  async appendBid(b) {
    const r = await db.sponsoredBid.create({
      data: {
        contentId: b.contentId, amount: b.amount, currency: b.currency, status: b.status,
        idempotencyKey: b.idempotencyKey ?? null, paymentId: b.paymentId ?? null,
        session: b.session ?? null, targetRank: b.targetRank ?? null,
      },
    });
    return { ...r } as SponsoredBid;
  },
  async findBidByIdempotencyKey(key) {
    const row = await db.sponsoredBid.findUnique({ where: { idempotencyKey: key } });
    return row ? { ...row } as SponsoredBid : null;
  },
  async updateBidStatus(id, status, paymentId, settledAt) {
    await db.sponsoredBid.update({
      where: { id }, data: { status, paymentId: paymentId ?? undefined, settledAt: settledAt ?? undefined },
    });
  },
  async activeBidsByContent(contentId) {
    const rows = await db.sponsoredBid.findMany({
      where: { contentId, status: "settled" }, orderBy: { amount: "desc" },
    });
    return rows.map(r => ({ ...r } as SponsoredBid));
  },
};

export const paymentRepo: PaymentRepository = {
  async insert(p) {
    const r = await db.payment.create({
      data: { provider: p.provider, providerPaymentId: p.providerPaymentId ?? null, amount: p.amount, currency: p.currency, status: p.status, webhookEventId: p.webhookEventId ?? null },
    });
    return { ...r } as Payment;
  },
  async findById(id) {
    const r = await db.payment.findUnique({ where: { id } });
    return r ? { ...r } as Payment : null;
  },
  async findByProviderPaymentId(pid) {
    const r = await db.payment.findUnique({ where: { providerPaymentId: pid } });
    return r ? { ...r } as Payment : null;
  },
  async findByWebhookEventId(eid) {
    const r = await db.payment.findUnique({ where: { webhookEventId: eid } });
    return r ? { ...r } as Payment : null;
  },
  async updateStatus(id, status, providerPaymentId, webhookEventId) {
    await db.payment.update({
      where: { id }, data: { status, providerPaymentId: providerPaymentId ?? undefined, webhookEventId: webhookEventId ?? undefined },
    });
  },
};

export const moderationRepo: ModerationRepository = {
  async insert(m) {
    const r = await db.moderationAction.create({
      data: { contentId: m.contentId, action: m.action, reason: m.reason, status: m.status, session: m.session ?? null },
    });
    return { ...r } as ModerationAction;
  },
  async listOpen() {
    const rows = await db.moderationAction.findMany({ where: { status: "open" }, orderBy: { createdAt: "desc" } });
    return rows.map(r => ({ ...r } as ModerationAction));
  },
  async resolve(id, status) {
    await db.moderationAction.update({ where: { id }, data: { status, resolvedAt: new Date() } });
  },
};

export const auditRepo: AuditRepository = {
  async insert(a) {
    const r = await db.auditLog.create({
      data: { actor: a.actor, action: a.action, targetType: a.targetType, targetId: a.targetId, payload: a.payload, requestId: a.requestId ?? null },
    });
    return { ...r } as AuditLog;
  },
  async listByTarget(targetType, targetId) {
    const rows = await db.auditLog.findMany({ where: { targetType, targetId }, orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map(r => ({ ...r } as AuditLog));
  },
  async recent(limit) {
    const rows = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(r => ({ ...r } as AuditLog));
  },
};

export const sessionRepo: SessionRepository = {
  async findById(id) {
    const r = await db.session.findUnique({ where: { id } });
    return r ? { ...r } as Session : null;
  },
  async create() {
    const r = await db.session.create({ data: {} });
    return { ...r } as Session;
  },
  async touch(id, patch) {
    await db.session.update({
      where: { id },
      data: {
        handle: patch.handle ?? undefined,
        location: patch.location ?? undefined,
        dailyHypeUsed: patch.dailyHypeUsed ?? undefined,
      },
    });
  },
};

export const subscriptionRepo: SubscriptionRepository = {
  async upsert(input) {
    const row = await db.subscription.upsert({
      where: { scopeKey: input.scopeKey },
      create: {
        email: input.email,
        entityId: input.entityId ?? null,
        scopeKey: input.scopeKey,
        session: input.session ?? null,
        confirmedAt: input.confirmedAt ?? null,
        confirmationTokenHash: input.confirmationTokenHash ?? null,
        confirmationExpiresAt: input.confirmationExpiresAt ?? null,
        unsubscribeTokenHash: input.unsubscribeTokenHash ?? null,
        lastNotifiedRank: input.lastNotifiedRank ?? null,
        lastNotifiedContentId: input.lastNotifiedContentId ?? null,
        lastNotifiedAt: input.lastNotifiedAt ?? null,
      },
      update: {
        email: input.email,
        session: input.session ?? undefined,
        confirmedAt: input.confirmedAt ?? undefined,
        confirmationTokenHash: input.confirmationTokenHash ?? undefined,
        confirmationExpiresAt: input.confirmationExpiresAt ?? undefined,
        unsubscribeTokenHash: input.unsubscribeTokenHash ?? undefined,
        lastNotifiedRank: input.lastNotifiedRank ?? undefined,
        lastNotifiedContentId: input.lastNotifiedContentId ?? undefined,
        lastNotifiedAt: input.lastNotifiedAt ?? undefined,
      },
    });
    return { ...row, ...(row.entityId ? { entityId: row.entityId } : {}), ...(row.session ? { session: row.session } : {}), ...(row.confirmedAt ? { confirmedAt: row.confirmedAt } : {}) } as Subscription;
  },
  async confirmByTokenHash(tokenHash) {
    const row = await db.subscription.findFirst({ where: { confirmationTokenHash: tokenHash, confirmationExpiresAt: { gt: new Date() } } });
    if (!row) return null;
    return db.subscription.update({ where: { id: row.id }, data: { confirmedAt: new Date(), confirmationTokenHash: null, confirmationExpiresAt: null } }) as Promise<Subscription>;
  },
  async deleteByUnsubscribeTokenHash(tokenHash) {
    const row = await db.subscription.findUnique({ where: { unsubscribeTokenHash: tokenHash } });
    if (!row) return false;
    await db.subscription.delete({ where: { id: row.id } });
    return true;
  },
  async listConfirmed() {
    const rows = await db.subscription.findMany({ where: { confirmedAt: { not: null } }, orderBy: { createdAt: "asc" } });
    return rows as Subscription[];
  },
  async markNotified(id, rank, contentId) {
    await db.subscription.update({ where: { id }, data: { lastNotifiedRank: rank, lastNotifiedContentId: contentId, lastNotifiedAt: new Date() } });
  },
};

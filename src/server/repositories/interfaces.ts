// Repository interfaces (ports). The application layer depends on these, not on
// Prisma. Swapping SQLite → PostgreSQL is replacing the adapter implementation;
// the interfaces stay identical.

import type {
  Content, Creator, Metric, OrganicRanking, SponsoredBid,
  Payment, ModerationAction, AuditLog, Session,
  Subscription,
  Category, ContentStatus,
} from "../domain/types";

export interface ContentRepository {
  findById(id: string): Promise<Content | null>;
  findByCanonicalId(canonicalId: string): Promise<Content | null>;
  findByUrl(url: string): Promise<Content | null>;
  listByCategory(category: Category, status?: ContentStatus): Promise<Content[]>;
  listAll(status?: ContentStatus): Promise<Content[]>;
  insert(c: Omit<Content, "id" | "createdAt" | "updatedAt">): Promise<Content>;
  update(id: string, patch: Partial<Pick<Content, "title" | "blurb" | "url">>): Promise<Content>;
  updateStatus(id: string, status: ContentStatus): Promise<void>;
}

export interface CreatorRepository {
  findById(id: string): Promise<Creator | null>;
  findByPlatformHandle(platform: string, handle: string): Promise<Creator | null>;
  upsert(c: Omit<Creator, "id" | "createdAt"> & { id?: string }): Promise<Creator>;
}

export interface MetricRepository {
  append(m: Omit<Metric, "id" | "fetchedAt">): Promise<Metric>;
  latestForContent(contentId: string): Promise<Metric | null>;
}

export interface RankingRepository {
  // organic
  appendOrganicSnapshot(r: Omit<OrganicRanking, "id" | "snapshotAt">): Promise<OrganicRanking>;
  latestOrganicByCategory(category: Category): Promise<OrganicRanking[]>;
  organicHistory(contentId: string, limit: number): Promise<OrganicRanking[]>;
  // sponsored
  appendBid(b: Omit<SponsoredBid, "id" | "createdAt">): Promise<SponsoredBid>;
  findBidByIdempotencyKey(key: string): Promise<SponsoredBid | null>;
  updateBidStatus(id: string, status: SponsoredBid["status"], paymentId?: string, settledAt?: Date): Promise<void>;
  activeBidsByContent(contentId: string): Promise<SponsoredBid[]>;
}

export interface PaymentRepository {
  insert(p: Omit<Payment, "id" | "createdAt" | "updatedAt">): Promise<Payment>;
  findById(id: string): Promise<Payment | null>;
  findByProviderPaymentId(pid: string): Promise<Payment | null>;
  findByWebhookEventId(eid: string): Promise<Payment | null>;
  updateStatus(id: string, status: Payment["status"], providerPaymentId?: string, webhookEventId?: string): Promise<void>;
}

export interface ModerationRepository {
  insert(m: Omit<ModerationAction, "id" | "createdAt">): Promise<ModerationAction>;
  listOpen(): Promise<ModerationAction[]>;
  resolve(id: string, status: ModerationAction["status"]): Promise<void>;
}

export interface AuditRepository {
  insert(a: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
  listByTarget(targetType: AuditLog["targetType"], targetId: string): Promise<AuditLog[]>;
  recent(limit: number): Promise<AuditLog[]>;
}

export interface SessionRepository {
  findById(id: string): Promise<Session | null>;
  create(): Promise<Session>;
  touch(id: string, patch: Partial<Pick<Session, "handle" | "location" | "dailyHypeUsed">>): Promise<void>;
}

export interface SubscriptionRepository {
  upsert(input: Omit<Subscription, "id" | "createdAt"> & { id?: string }): Promise<Subscription>;
  confirmByTokenHash(tokenHash: string): Promise<Subscription | null>;
  deleteByUnsubscribeTokenHash(tokenHash: string): Promise<boolean>;
  listConfirmed(): Promise<Subscription[]>;
  markNotified(id: string, rank: number, contentId: string): Promise<void>;
}

// Idempotency — Redis-shaped (in-memory impl today, Redis impl tomorrow).
export interface IdempotencyStore {
  get<T>(key: string): Promise<{ value: T; storedAt: number } | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

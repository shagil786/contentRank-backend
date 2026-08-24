// Domain types — pure business vocabulary. No I/O, no framework imports.
// These are the shapes the application services and repositories speak in.

// ---- Content domain ----
export type Platform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "x"
  | "threads"
  | "reddit"
  | "linkedin"
  | "spotify"
  | "soundcloud"
  | "steam"
  | "imdb"
  | "letterboxd"
  | "github"
  | "netflix"
  | "web"
  | "manual";

export type ContentKind =
  | "movie" | "show" | "anime" | "game" | "song" | "album"
  | "creator" | "post" | "product" | "website" | "ai"
  | "topic" | "person" | "moment";

export type Category =
  | "global" | "movies" | "tv" | "anime" | "games" | "music"
  | "creators" | "posts" | "ai" | "tech" | "sport" | "memes";

export type ContentStatus = "pending" | "live" | "flagged" | "removed";

export interface Content {
  id: string;
  canonicalId: string;       // e.g. "youtube:video:dQw4w9WgXcQ"
  platform: Platform;
  platformKey: string;       // platform-native content id
  url: string;               // public URL visitors click
  title: string;
  description?: string;
  imageUrl?: string;
  kind: ContentKind;
  category: Category;
  blurb?: string;
  creatorId?: string;
  submittedBy?: string;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Creator {
  id: string;
  platform: Platform;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface Metric {
  id: string;
  contentId: string;
  source: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  fetchedAt: Date;
}

// ---- Ranking domain (organic + sponsored are separate) ----
export interface OrganicRanking {
  id: string;
  contentId: string;
  category: Category;
  rank: number;
  score: number;       // organic hype
  momentum: number;
  snapshotAt: Date;
}

export interface SponsoredBid {
  id: string;
  contentId: string;
  amount: number;       // cents
  currency: string;
  status: "pending" | "settled" | "refunded" | "failed";
  idempotencyKey?: string;
  paymentId?: string;
  session?: string;
  targetRank?: number;
  createdAt: Date;
  settledAt?: Date;
}

// ---- Payments domain ----
export interface Payment {
  id: string;
  provider: "dodo" | "stub";
  providerPaymentId?: string;
  amount: number;
  currency: string;
  status: "initiated" | "succeeded" | "failed" | "refunded";
  webhookEventId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Moderation domain ----
export interface ModerationAction {
  id: string;
  contentId: string;
  action: "report" | "claim" | "review" | "hide" | "remove" | "restore";
  reason: string;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  session?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface Subscription {
  id: string;
  email: string;
  entityId?: string;
  scopeKey: string;
  session?: string;
  createdAt: Date;
  confirmedAt?: Date;
  confirmationTokenHash?: string;
  confirmationExpiresAt?: Date;
  unsubscribeTokenHash?: string;
  lastNotifiedRank?: number;
  lastNotifiedContentId?: string;
  lastNotifiedAt?: Date;
}

// ---- Audit domain ----
export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  targetType: "content" | "bid" | "payment" | "moderation" | "ranking" | "boost";
  targetId: string;
  payload: string;       // JSON
  requestId?: string;
  createdAt: Date;
}

// ---- Session ----
export interface Session {
  id: string;
  handle?: string;
  location?: string;
  dailyHypeUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

// OUTRANK — shared domain types (used by realtime mini-service + Next.js app)

export type Category =
  | "global"
  | "movies"
  | "tv"
  | "anime"
  | "games"
  | "music"
  | "creators"
  | "posts"
  | "ai"
  | "tech"
  | "sport"
  | "memes";

export const CATEGORIES: { id: Category; num: string; label: string }[] = [
  { id: "global", num: "01", label: "GLOBAL" },
  { id: "posts", num: "02", label: "POSTS" },
  { id: "creators", num: "03", label: "CREATORS" },
  { id: "tech", num: "04", label: "TECH" },
  { id: "ai", num: "05", label: "AI" },
  { id: "memes", num: "06", label: "MEMES" },
  { id: "games", num: "07", label: "GAMES" },
  { id: "anime", num: "08", label: "ANIME" },
  { id: "music", num: "09", label: "MUSIC" },
  { id: "sport", num: "10", label: "SPORT" },
  { id: "movies", num: "11", label: "MOVIES" },
  { id: "tv", num: "12", label: "TV" },
];

export type EntityKind =
  | "movie"
  | "show"
  | "anime"
  | "game"
  | "song"
  | "album"
  | "creator"
  | "post"
  | "product"
  | "website"
  | "ai"
  | "topic"
  | "person"
  | "community"
  | "moment";

export interface RankPoint {
  t: number; // epoch ms
  rank: number;
  score: number;
}

export interface Entity {
  id: string;
  slug: string;
  name: string;
  category: Category;
  kind: EntityKind;
  sub: string; // subtitle / context (year, artist, platform, handle)
  blurb: string;
  link?: string; // source URL the submitter provided (og:url or pasted link)
  image?: string; // og:image URL, if one was resolved at submit time
  score: number;
  supporters: number;
  prevRank: number;
  rank: number;
  peakRank: number;
  momentum: number; // positions moved in last 24h (signed)
  history: RankPoint[]; // last ~24h rank trajectory
  createdAt: number;
  // deterministic generative poster config
  poster: { hue: number; accent: string; tag: string };
}

export interface ActivityEvent {
  id: string;
  type: "boosted" | "took_one" | "defended" | "added" | "battle" | "system";
  entityId: string;
  entityName: string;
  category: Category;
  amount: number;
  fromRank: number;
  toRank: number;
  location: string;
  handle: string; // who did it
  ts: number;
}

export interface LeaderState {
  entities: Entity[];
  activity: ActivityEvent[];
  presence: number;
  totalBoosts: number;
  ts: number;
  nextCursor?: string;
  total?: number;
}

// realtime event envelopes
export interface RankUpdatedEvent {
  type: "rank.updated";
  entityId: string;
  category: Category;
  prevRank: number;
  newRank: number;
  prevScore: number;
  newScore: number;
  displaced: { entityId: string; fromRank: number; toRank: number }[];
  ts: number;
}

export interface ActivityCreatedEvent {
  type: "activity.created";
  event: ActivityEvent;
}

export interface PresenceUpdatedEvent {
  type: "presence.updated";
  count: number;
  fighting: number; // people currently in a boost flow
}

export interface LeaderChangedEvent {
  type: "leader.changed";
  category: Category;
  entityId: string;
  entityName: string;
  prevLeaderId: string | null;
}

export interface SnapshotEvent {
  type: "snapshot";
  state: LeaderState;
}

export interface BoostAckEvent {
  type: "boost.ack";
  ok: boolean;
  reason?: string;
  entityId: string;
  newRank: number;
  prevRank: number;
  newScore: number;
  remaining: number; // daily hype remaining for session
}

export interface AllocationEvent {
  type: "allocation";
  remaining: number;
  total: number;
}

export type ServerEvent =
  | SnapshotEvent
  | RankUpdatedEvent
  | ActivityCreatedEvent
  | PresenceUpdatedEvent
  | LeaderChangedEvent
  | BoostAckEvent
  | AllocationEvent;

// client -> server
export interface BoostRequest {
  entityId: string;
  amount: number;
  handle?: string;
  location?: string;
}

export interface AddEntityRequest {
  name: string;
  category: Category;
  kind: EntityKind;
  sub: string;
  blurb: string;
  link?: string; // source URL — used to fetch OpenGraph metadata before commit
  image?: string; // resolved og:image (optional, server can also derive)
}

// Result of server-side OpenGraph extraction from a URL.
export interface OgResult {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
  ok: boolean;
  reason?: string;
}

// Currency: USD. No daily limit. Users pay to boost.
// Score = total USD backed (in cents for precision, displayed as $).
export const DAILY_HYPE = 0; // deprecated — kept for compat, unused

export function formatScore(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return "$" + Math.round(n).toString();
}

// Format a USD amount from cents (for bid amounts).
// Tiers: $1, $999, $1.5K, $10K, $100K, $1M...
export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return "$" + (dollars / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (dollars >= 1_000) return "$" + (dollars / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  if (cents % 100 === 0) return "$" + Math.round(dollars);
  return "$" + dollars.toFixed(2);
}

export function rankDelta(prev: number, cur: number): number {
  // positive = rose (better), negative = fell
  return prev - cur;
}

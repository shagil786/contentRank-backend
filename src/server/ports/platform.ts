// OUTRANK — platform adapter port (interface).
//
// A platform adapter knows how to (a) recognize a URL as belonging to its
// platform, (b) extract a canonical content identity from that URL, and
// (c) optionally fetch fresh engagement metrics. Each platform gets its own
// adapter so the core domain never imports platform-specific code.
//
// `matches` and `canonicalize` MUST be pure — no network, no IO, just URL
// parsing. `fetchMetrics` and `fetchPreview` are the only IO-bearing methods
// and are always optional / best-effort.

export type PlatformName =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "x"
  | "threads"
  | "reddit"
  | "linkedin"
  | "web";

export interface CanonicalContent {
  platform: string; // PlatformName (kept as string for open extensibility)
  platformKey: string; // platform-specific stable content id (video id, post id, ...)
  canonicalId: string; // "<platform>:<contentType>:<platformKey>" — globally unique
  contentType: string; // "video" | "post" | "reel" | "tweet" | "thread" | "article" | "page" | ...
  url: string; // canonical public URL to view the content
}

export interface PlatformMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  fetchedAt: number; // epoch ms
}

export interface PlatformAdapter {
  readonly platform: string;
  /** returns true if this adapter handles the given URL (pure) */
  matches(url: string): boolean;
  /** extract canonical identity from a URL — pure, no network call */
  canonicalize(url: string): CanonicalContent | null;
  /** optionally fetch live engagement metrics — network call, may throw / return null */
  fetchMetrics?(canonical: CanonicalContent): Promise<PlatformMetrics | null>;
}

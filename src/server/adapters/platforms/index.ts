// OUTRANK — platform adapter registry.
//
// Exports the ordered list of platform adapters (specific platforms first,
// generic web fallback last) and two convenience helpers:
//   • resolveAdapter(url) — first adapter whose matches(url) is true
//   • canonicalize(url)   — resolveAdapter(url)?.canonicalize(url)
//
// The registry is the single integration point: the core domain imports from
// here only, never from individual adapter modules.

import type {
  CanonicalContent,
  PlatformAdapter,
} from "@/server/ports/platform";
import { InstagramAdapter } from "./instagram";
import { LinkedInAdapter } from "./linkedin";
import { RedditAdapter } from "./reddit";
import { ThreadsAdapter } from "./threads";
import { TikTokAdapter } from "./tiktok";
import { WebAdapter } from "./web";
import { XAdapter } from "./x";
import { YouTubeAdapter } from "./youtube";

// Priority order: most-specific platforms first, generic web last so any URL
// the specific adapters don't claim still resolves to *something*.
export const platformAdapters: PlatformAdapter[] = [
  new InstagramAdapter(),
  new YouTubeAdapter(),
  new TikTokAdapter(),
  new XAdapter(),
  new ThreadsAdapter(),
  new RedditAdapter(),
  new LinkedInAdapter(),
  new WebAdapter(),
];

/** Returns the first adapter that handles the URL, or null if none match. */
export function resolveAdapter(url: string): PlatformAdapter | null {
  for (const adapter of platformAdapters) {
    if (adapter.matches(url)) return adapter;
  }
  return null;
}

/** Resolves the adapter for `url` and returns its canonical content (or null). */
export function canonicalize(url: string): CanonicalContent | null {
  const adapter = resolveAdapter(url);
  if (!adapter) return null;
  return adapter.canonicalize(url);
}

// Re-exports for callers that want direct class access (e.g. to inject a mock
// in tests, or to call fetchPreview / fetchMetrics on a known adapter type).
export { OgBasedAdapter } from "./base";
export type { PlatformPreview } from "./base";
export { InstagramAdapter } from "./instagram";
export { YouTubeAdapter } from "./youtube";
export { TikTokAdapter } from "./tiktok";
export { XAdapter } from "./x";
export { ThreadsAdapter } from "./threads";
export { RedditAdapter } from "./reddit";
export { LinkedInAdapter } from "./linkedin";
export { WebAdapter } from "./web";

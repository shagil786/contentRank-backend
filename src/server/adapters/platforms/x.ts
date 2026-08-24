// OUTRANK — X (Twitter) platform adapter.
//
// Matches:
//   • x.com/<user>/status/<id>          → contentType "tweet"
//   • twitter.com/<user>/status/<id>    → contentType "tweet"
//
// Canonical URL is always on x.com. platformKey is the status id (numeric,
// stable across username changes).
// `matches` and `canonicalize` are pure (URL parsing only, no network).

import type { CanonicalContent } from "@/server/ports/platform";
import { OgBasedAdapter } from "./base";

export class XAdapter extends OgBasedAdapter {
  readonly platform = "x";

  matches(url: string): boolean {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return false;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "x.com" && host !== "twitter.com") return false;
    return /^\/[^/]+\/status\/\d+/.test(u.pathname);
  }

  canonicalize(url: string): CanonicalContent | null {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return null;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "x.com" && host !== "twitter.com") return null;

    const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (!m) return null;
    const user = m[1];
    const id = m[2];
    return {
      platform: this.platform,
      platformKey: id,
      canonicalId: `${this.platform}:tweet:${id}`,
      contentType: "tweet",
      url: `https://x.com/${user}/status/${id}`,
    };
  }
}

// OUTRANK — TikTok platform adapter.
//
// Matches:
//   • tiktok.com/@<user>/video/<id>     → contentType "video"
//   • www.tiktok.com/@<user>/video/<id>
//   • m.tiktok.com/@<user>/video/<id>
//
// platformKey is the numeric video id (stable across username changes).
// `matches` and `canonicalize` are pure (URL parsing only, no network).

import type { CanonicalContent } from "@/server/ports/platform";
import { OgBasedAdapter } from "./base";

export class TikTokAdapter extends OgBasedAdapter {
  readonly platform = "tiktok";

  matches(url: string): boolean {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return false;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "tiktok.com" && host !== "m.tiktok.com") return false;
    return /^\/@[^/]+\/video\/\d+/.test(u.pathname);
  }

  canonicalize(url: string): CanonicalContent | null {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return null;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "tiktok.com" && host !== "m.tiktok.com") return null;

    const m = u.pathname.match(/^\/@([^/]+)\/video\/(\d+)/);
    if (!m) return null;
    const user = m[1];
    const id = m[2];
    return {
      platform: this.platform,
      platformKey: id,
      canonicalId: `${this.platform}:video:${id}`,
      contentType: "video",
      url: `https://www.tiktok.com/@${user}/video/${id}`,
    };
  }
}

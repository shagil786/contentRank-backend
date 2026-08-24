// OUTRANK — Instagram platform adapter.
//
// Matches:
//   • instagram.com/p/<id>           → contentType "post"
//   • instagram.com/reel/<id>        → contentType "reel"
//   • instagram.com/reels/<id>       → contentType "reel"
//   • instagr.am/p/<id> | /reel/<id> (short domain)
//
// `matches` and `canonicalize` are pure (URL parsing only, no network).

import type { CanonicalContent } from "@/server/ports/platform";
import { OgBasedAdapter } from "./base";

export class InstagramAdapter extends OgBasedAdapter {
  readonly platform = "instagram";

  matches(url: string): boolean {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return false;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "instagram.com" && host !== "instagr.am") return false;
    return /^\/(p|reels?)\/[^/]+/i.test(u.pathname);
  }

  canonicalize(url: string): CanonicalContent | null {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return null;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "instagram.com" && host !== "instagr.am") return null;

    const postMatch = u.pathname.match(/^\/p\/([^/?#]+)/i);
    if (postMatch) {
      const id = postMatch[1];
      return {
        platform: this.platform,
        platformKey: id,
        canonicalId: `${this.platform}:post:${id}`,
        contentType: "post",
        url: `https://www.instagram.com/p/${id}/`,
      };
    }

    const reelMatch = u.pathname.match(/^\/reels?\/([^/?#]+)/i);
    if (reelMatch) {
      const id = reelMatch[1];
      return {
        platform: this.platform,
        platformKey: id,
        canonicalId: `${this.platform}:reel:${id}`,
        contentType: "reel",
        url: `https://www.instagram.com/reel/${id}/`,
      };
    }

    return null;
  }
}

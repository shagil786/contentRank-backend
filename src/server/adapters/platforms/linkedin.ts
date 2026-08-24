// OUTRANK — LinkedIn platform adapter.
//
// Matches:
//   • linkedin.com/posts/<slug>                          → contentType "post"
//     (slug often contains "activity-<id>" or "<handle>-activity-<id>-<index>")
//   • linkedin.com/feed/update/activity:<id>             → contentType "post"
//   • linkedin.com/feed/update/urn:li:activity:<id>      → contentType "post"
//
// platformKey is the trailing numeric activity id when we can extract it,
// otherwise the raw slug (best-effort — LinkedIn URL shapes vary).
// `matches` and `canonicalize` are pure (URL parsing only, no network).

import type { CanonicalContent } from "@/server/ports/platform";
import { OgBasedAdapter } from "./base";

export class LinkedInAdapter extends OgBasedAdapter {
  readonly platform = "linkedin";

  matches(url: string): boolean {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return false;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "linkedin.com") return false;
    return /^\/(posts|feed)\//i.test(u.pathname);
  }

  canonicalize(url: string): CanonicalContent | null {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return null;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "linkedin.com") return null;

    // /posts/<slug>
    const postsMatch = u.pathname.match(/^\/posts\/([^/?#]+)/i);
    if (postsMatch) {
      const slug = postsMatch[1];
      const id = this.extractActivityId(slug) ?? slug;
      return {
        platform: this.platform,
        platformKey: id,
        canonicalId: `${this.platform}:post:${id}`,
        contentType: "post",
        url: `https://www.linkedin.com/posts/${slug}`,
      };
    }

    // /feed/update/activity:<id>   (or urn:li:activity:<id>)
    const feedMatch = u.pathname.match(
      /^\/feed\/update\/(?:urn:li:)?activity:([^/?#]+)/i,
    );
    if (feedMatch) {
      const id = feedMatch[1];
      return {
        platform: this.platform,
        platformKey: id,
        canonicalId: `${this.platform}:post:${id}`,
        contentType: "post",
        url: `https://www.linkedin.com/feed/update/activity:${id}`,
      };
    }

    return null;
  }

  /**
   * Pulls the trailing numeric activity id out of a slug like
   * "activity-7217890463283773440-XXXX" or "johndoe-activity-7217890463283773440-XXXX".
   * Returns null when no numeric activity id is present.
   */
  private extractActivityId(slug: string): string | null {
    const m = slug.match(/activity-(\d+)/i);
    return m ? m[1] : null;
  }
}

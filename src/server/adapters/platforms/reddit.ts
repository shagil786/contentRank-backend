// OUTRANK — Reddit platform adapter.
//
// Matches:
//   • reddit.com/r/<sub>/comments/<id>[/<slug>]   → contentType "post"
//   • old.reddit.com/r/<sub>/comments/<id>/...
//   • new.reddit.com/r/<sub>/comments/<id>/...
//   • redd.it/<id>                                → contentType "post"
//
// platformKey is the submission id (stable, base-36-ish). Canonical URL is the
// pretty /r/<sub>/comments/<id>/ form.
// `matches` and `canonicalize` are pure (URL parsing only, no network).

import type { CanonicalContent } from "@/server/ports/platform";
import { OgBasedAdapter } from "./base";

export class RedditAdapter extends OgBasedAdapter {
  readonly platform = "reddit";

  matches(url: string): boolean {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return false;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host === "redd.it") return /^\/[^/?#]+/.test(u.pathname);
    if (host === "reddit.com" || host === "old.reddit.com" || host === "new.reddit.com") {
      return /\/r\/[^/]+\/comments\/[^/?#]+/i.test(u.pathname);
    }
    return false;
  }

  canonicalize(url: string): CanonicalContent | null {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return null;
    const host = OgBasedAdapter.normalizeHost(u);

    // redd.it/<id>
    if (host === "redd.it") {
      const id = u.pathname.slice(1).split("/")[0];
      if (!id) return null;
      return this.postContent(id, `https://www.reddit.com/comments/${id}`);
    }

    if (
      host !== "reddit.com" &&
      host !== "old.reddit.com" &&
      host !== "new.reddit.com"
    ) {
      return null;
    }

    // /r/<sub>/comments/<id>[/<slug>]
    const m = u.pathname.match(/\/r\/([^/]+)\/comments\/([^/?#]+)/i);
    if (!m) return null;
    const sub = m[1];
    const id = m[2];
    return this.postContent(
      id,
      `https://www.reddit.com/r/${sub}/comments/${id}/`,
    );
  }

  private postContent(id: string, url: string): CanonicalContent {
    return {
      platform: this.platform,
      platformKey: id,
      canonicalId: `${this.platform}:post:${id}`,
      contentType: "post",
      url,
    };
  }
}

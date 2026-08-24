// OUTRANK — YouTube platform adapter.
//
// Matches:
//   • youtube.com/watch?v=<id>       → contentType "video"
//   • youtu.be/<id>                  → contentType "video"
//   • youtube.com/shorts/<id>        → contentType "short"
//   • youtube.com/embed/<id>         → contentType "video"  (canonicalized to /watch?v=)
//   • m.youtube.com/*                (mobile host)
//
// Canonical URL for videos is always https://www.youtube.com/watch?v=<id>.
// `matches` and `canonicalize` are pure (URL parsing only, no network).

import type { CanonicalContent } from "@/server/ports/platform";
import { OgBasedAdapter } from "./base";

export class YouTubeAdapter extends OgBasedAdapter {
  readonly platform = "youtube";

  matches(url: string): boolean {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return false;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host === "youtu.be") {
      return /^\/[^/?#]+/.test(u.pathname);
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.has("v");
      return /^\/(shorts|embed)\/[^/?#]+/i.test(u.pathname);
    }
    return false;
  }

  canonicalize(url: string): CanonicalContent | null {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return null;
    const host = OgBasedAdapter.normalizeHost(u);

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (!id) return null;
      return this.videoContent(id);
    }

    if (host !== "youtube.com" && host !== "m.youtube.com") return null;

    // /watch?v=<id>
    if (u.pathname === "/watch") {
      const id = u.searchParams.get("v");
      if (!id) return null;
      return this.videoContent(id);
    }

    // /shorts/<id>
    const shortMatch = u.pathname.match(/^\/shorts\/([^/?#]+)/i);
    if (shortMatch) {
      const id = shortMatch[1];
      return {
        platform: this.platform,
        platformKey: id,
        canonicalId: `${this.platform}:short:${id}`,
        contentType: "short",
        url: `https://www.youtube.com/shorts/${id}`,
      };
    }

    // /embed/<id> → canonicalize to /watch?v=
    const embedMatch = u.pathname.match(/^\/embed\/([^/?#]+)/i);
    if (embedMatch) {
      return this.videoContent(embedMatch[1]);
    }

    return null;
  }

  private videoContent(id: string): CanonicalContent {
    return {
      platform: this.platform,
      platformKey: id,
      canonicalId: `${this.platform}:video:${id}`,
      contentType: "video",
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  }
}

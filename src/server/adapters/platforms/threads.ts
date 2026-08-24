// OUTRANK — Threads platform adapter.
//
// Matches:
//   • threads.com/@<user>/post/<id>     → contentType "thread"
//   • threads.net/@<user>/post/<id>     → contentType "thread"
//
// Canonical URL is always on threads.net (the original domain). platformKey is
// the post id.
// `matches` and `canonicalize` are pure (URL parsing only, no network).

import type { CanonicalContent } from "@/server/ports/platform";
import { OgBasedAdapter } from "./base";

export class ThreadsAdapter extends OgBasedAdapter {
  readonly platform = "threads";

  matches(url: string): boolean {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return false;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "threads.com" && host !== "threads.net") return false;
    return /^\/@[^/]+\/post\/[^/?#]+/i.test(u.pathname);
  }

  canonicalize(url: string): CanonicalContent | null {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return null;
    const host = OgBasedAdapter.normalizeHost(u);
    if (host !== "threads.com" && host !== "threads.net") return null;

    const m = u.pathname.match(/^\/@([^/]+)\/post\/([^/?#]+)/i);
    if (!m) return null;
    const user = m[1];
    const id = m[2];
    return {
      platform: this.platform,
      platformKey: id,
      canonicalId: `${this.platform}:thread:${id}`,
      contentType: "thread",
      url: `https://www.threads.net/@${user}/post/${id}`,
    };
  }
}

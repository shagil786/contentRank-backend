// OUTRANK — Web fallback platform adapter.
//
// Matches any http(s) URL that no specific platform adapter claims (e.g.
// Letterboxd film pages, Spotify tracks, Steam app pages, blog posts, news
// articles, ...). contentType is always "page". canonicalId is
// `web:page:<hash>` where <hash> is a stable FNV-1a 32-bit hash of the
// normalized `host+path+sorted-query` — so the same URL always maps to the
// same canonical id regardless of query-param order or trailing slash.
//
// `matches` and `canonicalize` are pure (URL parsing only, no network).

import type { CanonicalContent } from "@/server/ports/platform";
import { OgBasedAdapter } from "./base";

export class WebAdapter extends OgBasedAdapter {
  readonly platform = "web";

  matches(url: string): boolean {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return false;
    return u.protocol === "http:" || u.protocol === "https:";
  }

  canonicalize(url: string): CanonicalContent | null {
    const u = OgBasedAdapter.parseUrl(url);
    if (!u) return null;
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;

    // Normalize: lowercase host, drop default ports, strip trailing slashes on
    // the path (but keep "/"), drop hash fragment, sort query params for stability.
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(u.searchParams);
    params.sort();
    const query = params.toString();
    const identity = query ? `${host}${path}?${query}` : `${host}${path}`;

    const platformKey = fnv1aHex(identity);

    return {
      platform: this.platform,
      platformKey,
      canonicalId: `${this.platform}:page:${platformKey}`,
      contentType: "page",
      url: `${u.protocol}//${host}${path}${query ? `?${query}` : ""}`,
    };
  }
}

/** FNV-1a 32-bit hash → hex string. Stable, dependency-free, good enough for id. */
function fnv1aHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Server-side OpenGraph metadata extraction.
// Fetches a URL, parses <meta> tags for og:* / twitter:* / standard title+description,
// and returns a normalized OgResult. Used by the AddEntity flow to auto-fill the form
// from a pasted link (Movie/TV/Game/Song/Creator/Post/Product/Website URLs).

import type { OgResult } from "@/lib/outrank/types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Sec-CH-UA": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"macOS"',
};

// Resolve a possibly-relative URL (og:image often comes as "/img/x.png") against the page URL.
function resolveUrl(maybeRelative: string, base: string): string | undefined {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return undefined;
  }
}

// Pull a meta content by property/name using a regex over the raw HTML.
// Handles og:title, og:description, og:image, og:url, og:site_name, og:type,
// twitter:title, twitter:description, twitter:image, twitter:card.
function meta(html: string, keys: string[]): string | undefined {
  for (const k of keys) {
    // property="..." content="..."
    const reProp = new RegExp(
      `<meta[^>]+(?:property|name)=["']${k}["'][^>]*?content=["']([^"']+)["']`,
      "i"
    );
    const m1 = html.match(reProp);
    if (m1) return decode(m1[1]);
    // content="..." property="..." (reversed attr order)
    const reRev = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*?(?:property|name)=["']${k}["']`,
      "i"
    );
    const m2 = html.match(reRev);
    if (m2) return decode(m2[1]);
  }
  return undefined;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .trim();
}

function ogTitle(html: string): string | undefined {
  return (
    meta(html, ["og:title", "twitter:title"]) ||
    (() => {
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return m ? decode(m[1]) : undefined;
    })()
  );
}

function ogDescription(html: string): string | undefined {
  return (
    meta(html, ["og:description", "twitter:description"]) ||
    meta(html, ["description"]) ||
    undefined
  );
}

function ogImage(html: string, base: string): string | undefined {
  const raw =
    meta(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]) ||
    undefined;
  if (!raw) return undefined;
  return resolveUrl(raw, base);
}

function ogSiteName(html: string): string | undefined {
  return meta(html, ["og:site_name", "application-name"]) || undefined;
}

function ogType(html: string): string | undefined {
  return meta(html, ["og:type"]) || undefined;
}

function ogUrl(html: string, base: string): string | undefined {
  const raw = meta(html, ["og:url", "twitter:url"]);
  if (!raw) return base;
  return resolveUrl(raw, base) || base;
}

export async function fetchOpenGraph(url: string): Promise<OgResult> {
  // Validate + normalize the URL.
  let u: URL;
  try {
    u = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return { url, ok: false, reason: "bad_url" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { url, ok: false, reason: "bad_scheme" };
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);

  try {
    const res = await fetch(u.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: FETCH_HEADERS,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { url: u.toString(), ok: false, reason: `http_${res.status}` };
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      // Not an HTML page — can't parse OG. Return the URL itself as the link.
      return {
        url: u.toString(),
        ok: true,
        title: u.hostname.replace(/^www\./, ""),
        siteName: u.hostname.replace(/^www\./, ""),
        type: "non_html",
      };
    }

    // Only read the first ~256KB — meta tags live in <head> anyway.
    const reader = res.body?.getReader();
    if (!reader) {
      return { url: u.toString(), ok: false, reason: "no_body" };
    }
    let html = "";
    const decoder = new TextDecoder("utf-8");
    let bytes = 0;
    const MAX = 256 * 1024;
    while (bytes < MAX) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        html += decoder.decode(value, { stream: true });
        bytes += value.length;
      }
    }
    // Stop at </head> if present, to keep the string small.
    const headEnd = html.search(/<\/head>/i);
    if (headEnd > 0) html = html.slice(0, headEnd);

    const finalUrl = res.url || u.toString();
    const title = ogTitle(html);
    const description = ogDescription(html);
    const image = ogImage(html, finalUrl);
    const siteName = ogSiteName(html) || finalUrl.hostname.replace(/^www\./, "");
    const type = ogType(html);
    const canonical = ogUrl(html, finalUrl);

    if (!title && !description && !image) {
      return { url: finalUrl, ok: false, reason: "no_meta" };
    }

    return {
      url: canonical,
      title,
      description,
      image,
      siteName,
      type,
      ok: true,
    };
  } catch (e: any) {
    clearTimeout(timeout);
    const reason = e?.name === "AbortError" ? "timeout" : "fetch_failed";
    return { url: u.toString(), ok: false, reason };
  }
}

// Platform adapters. Two layers:
// 1. Per-platform URL parsers (extract canonical id + creator handle from known URL shapes)
// 2. A shared OpenGraph fetcher (server-side metadata extraction) used by all adapters
//
// In production each platform adapter would call that platform's official API
// (Instagram Graph API, YouTube Data API, etc.). Here we use OpenGraph as the
// universal metadata source and parse URLs for canonical identity. The
// interface is identical, so swapping in real API adapters is additive.

import type { Platform, ContentKind, Category } from "../../domain/types";
import { fetchOpenGraph } from "../../../lib/outrank/og";
import {
  type PlatformAdapter,
  type CanonicalContent,
  registerPlatformAdapter,
} from "./interface";

// ---- URL parsing per platform ----
interface ParsedUrl {
  platformKey: string;     // stable content id
  creatorHandle?: string;
}

function parseYoutube(url: string): ParsedUrl | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return { platformKey: u.pathname.slice(1) };
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return { platformKey: v };
      const m = u.pathname.match(/\/(shorts|embed)\/([^/]+)/);
      if (m) return { platformKey: m[2] };
      const ch = u.pathname.match(/\/@?([\w.-]+)/);
      if (ch) return { platformKey: "channel:" + ch[1], creatorHandle: "@" + ch[1] };
    }
  } catch { /* ignore */ }
  return null;
}

function parseInstagram(url: string): ParsedUrl | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("instagram.com")) return null;
    const m = u.pathname.match(/\/p\/([^/]+)|\/reel\/([^/]+)|\/stories\/([^/]+)/);
    if (m) return { platformKey: m[1] || m[2] || m[3] };
    const c = u.pathname.match(/^\/([\w.]+)\/?$/);
    if (c && c[1] !== "") return { platformKey: "profile:" + c[1], creatorHandle: "@" + c[1] };
  } catch { /* ignore */ }
  return null;
}

function parseTiktok(url: string): ParsedUrl | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("tiktok.com")) return null;
    const m = u.pathname.match(/\/@([\w.]+)\/video\/(\d+)/);
    if (m) return { platformKey: m[2], creatorHandle: "@" + m[1] };
    const c = u.pathname.match(/\/@([\w.]+)/);
    if (c) return { platformKey: "profile:" + c[1], creatorHandle: "@" + c[1] };
  } catch { /* ignore */ }
  return null;
}

function parseX(url: string): ParsedUrl | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("x.com") && !u.hostname.includes("twitter.com")) return null;
    const m = u.pathname.match(/\/([\w]+)\/status\/(\d+)/);
    if (m) return { platformKey: m[2], creatorHandle: "@" + m[1] };
    const c = u.pathname.match(/^\/([\w]+)/);
    if (c) return { platformKey: "profile:" + c[1], creatorHandle: "@" + c[1] };
  } catch { /* ignore */ }
  return null;
}

function parseReddit(url: string): ParsedUrl | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("reddit.com")) return null;
    const m = u.pathname.match(/\/r\/([\w]+)\/comments\/([\w]+)/);
    if (m) return { platformKey: `${m[1]}:${m[2]}` };
    const c = u.pathname.match(/\/u(?:ser)?\/([\w]+)/);
    if (c) return { platformKey: "user:" + c[1], creatorHandle: "u/" + c[1] };
  } catch { /* ignore */ }
  return null;
}

function parseSpotify(url: string): ParsedUrl | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    const m = u.pathname.match(/\/(track|album|episode|show)\/([\w]+)/);
    if (m) return { platformKey: `${m[1]}:${m[2]}` };
  } catch { /* ignore */ }
  return null;
}

function parseGeneric(url: string): ParsedUrl {
  // fallback: hash the URL for a stable key
  return { platformKey: "url:" + url };
}

// ---- Shared resolver: parse URL + fetch OpenGraph ----
async function resolveWithOg(
  platform: Platform,
  url: string,
  parse: (u: string) => ParsedUrl | null,
): Promise<CanonicalContent | null> {
  const parsed = parse(url) ?? parseGeneric(url);
  const og = await fetchOpenGraph(url);
  const canonicalId = `${platform}:${parsed.platformKey}`;
  return {
    canonicalId,
    platform,
    platformKey: parsed.platformKey,
    url: og.ok ? og.url ?? url : url,
    title: og.title || url,
    description: og.description,
    imageUrl: og.image,
    creatorHandle: parsed.creatorHandle,
    creatorName: parsed.creatorHandle,
  };
}

// ---- Adapter definitions ----
const youtubeAdapter: PlatformAdapter = {
  platform: "youtube",
  matches: (u) => /youtube\.com|youtu\.be/i.test(u),
  resolve: (u) => resolveWithOg("youtube", u, parseYoutube),
  async fetchMetrics(platformKey) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey || platformKey.startsWith("channel:") || platformKey.startsWith("profile:")) return null;
    if (!/^[A-Za-z0-9_-]{6,}$/.test(platformKey)) return null;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5_000);
    try {
      const params = new URLSearchParams({ part: "statistics", id: platformKey, key: apiKey });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = await response.json() as { items?: { statistics?: Record<string, string> }[] };
      const stats = data.items?.[0]?.statistics;
      if (!stats) return null;
      return {
        views: Number(stats.viewCount || 0),
        likes: Number(stats.likeCount || 0),
        comments: Number(stats.commentCount || 0),
        shares: 0,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  },
};

const instagramAdapter: PlatformAdapter = {
  platform: "instagram",
  matches: (u) => /instagram\.com/i.test(u),
  resolve: (u) => resolveWithOg("instagram", u, parseInstagram),
};

const tiktokAdapter: PlatformAdapter = {
  platform: "tiktok",
  matches: (u) => /tiktok\.com/i.test(u),
  resolve: (u) => resolveWithOg("tiktok", u, parseTiktok),
};

const xAdapter: PlatformAdapter = {
  platform: "x",
  matches: (u) => /x\.com|twitter\.com/i.test(u),
  resolve: (u) => resolveWithOg("x", u, parseX),
};

const redditAdapter: PlatformAdapter = {
  platform: "reddit",
  matches: (u) => /reddit\.com/i.test(u),
  resolve: (u) => resolveWithOg("reddit", u, parseReddit),
};

const spotifyAdapter: PlatformAdapter = {
  platform: "spotify",
  matches: (u) => /spotify\.com/i.test(u),
  resolve: (u) => resolveWithOg("spotify", u, parseSpotify),
};

const webAdapter: PlatformAdapter = {
  platform: "web",
  matches: () => true, // universal fallback
  resolve: (u) => resolveWithOg("web", u, () => parseGeneric(u)),
};

// register all adapters (order doesn't matter — resolveAdapterForUrl checks matches())
[youtubeAdapter, instagramAdapter, tiktokAdapter, xAdapter, redditAdapter, spotifyAdapter, webAdapter].forEach(registerPlatformAdapter);

// heuristics for kind/category from platform (used when submitter doesn't specify)
export function guessKindFromPlatform(platform: Platform): { kind: ContentKind; category: Category } | null {
  switch (platform) {
    case "youtube":
    case "tiktok":
    case "x":
    case "reddit":
    case "instagram":
    case "threads":
      return { kind: "post", category: "creators" };
    case "spotify":
    case "soundcloud":
      return { kind: "song", category: "music" };
    case "steam":
      return { kind: "game", category: "games" };
    case "imdb":
    case "letterboxd":
      return { kind: "movie", category: "movies" };
    case "github":
      return { kind: "website", category: "tech" };
    default:
      return null;
  }
}

// OUTRANK — shared base class for platform adapters.
//
// Most social platforms are aggressively bot-protected and require OAuth/API
// keys to fetch live metrics, which the prototype doesn't have. This base class
// therefore:
//   • implements `fetchMetrics` as a no-op (returns null) so subclasses can opt
//     out trivially,
//   • exposes an OG-based `fetchPreview(url)` helper that calls the pure server
//     function `fetchOpenGraph` from `@/lib/outrank/og` (NO dependency on any
//     Next.js route),
//   • provides a couple of pure URL-normalization helpers shared by every
//     adapter (`parseUrl`, `normalizeHost`).
//
// Adapters extend this class and only need to implement `matches` + `canonicalize`.

import { fetchOpenGraph } from "@/lib/outrank/og";
import type {
  CanonicalContent,
  PlatformAdapter,
  PlatformMetrics,
} from "@/server/ports/platform";

export interface PlatformPreview {
  title?: string;
  description?: string;
  image?: string;
}

export abstract class OgBasedAdapter implements PlatformAdapter {
  abstract readonly platform: string;
  abstract matches(url: string): boolean;
  abstract canonicalize(url: string): CanonicalContent | null;

  /** Default no-op: prototype adapters don't have API credentials. */
  async fetchMetrics(
    _canonical: CanonicalContent,
  ): Promise<PlatformMetrics | null> {
    return null;
  }

  /**
   * Best-effort OpenGraph preview. Pure server function — does NOT go through
   * any Next.js route. Returns null on any failure (bot-protected hosts, 4xx,
   * timeouts, non-HTML responses, etc).
   */
  async fetchPreview(url: string): Promise<PlatformPreview | null> {
    const og = await fetchOpenGraph(url);
    if (!og.ok) return null;
    return {
      title: og.title,
      description: og.description,
      image: og.image,
    };
  }

  // ---- shared pure helpers -------------------------------------------------

  /**
   * Safely parse a URL string. If the scheme is missing, prepend `https://`
   * (the common case for pasted links). Returns null on invalid input —
   * callers should treat null as "this adapter does not match".
   */
  protected static parseUrl(raw: string): URL | null {
    if (!raw) return null;
    try {
      const withScheme =
        raw.startsWith("http://") || raw.startsWith("https://")
          ? raw
          : `https://${raw}`;
      return new URL(withScheme);
    } catch {
      return null;
    }
  }

  /** Lowercase the hostname and strip the leading `www.` for stable matching. */
  protected static normalizeHost(url: URL): string {
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  }
}

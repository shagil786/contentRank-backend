// Platform adapter interface. Social platforms are accessed ONLY through this.
// Each platform (Instagram, YouTube, TikTok, etc.) gets its own implementation.
// Adding a platform = adding a class that implements PlatformAdapter.

import type { Platform } from "../../domain/types";

export interface CanonicalContent {
  canonicalId: string;   // e.g. "youtube:video:dQw4w9WgXcQ"
  platform: Platform;
  platformKey: string;   // platform-native id
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  creatorHandle?: string;
  creatorName?: string;
}

export interface PlatformAdapter {
  readonly platform: Platform;
  /** returns true if this adapter handles the given URL */
  matches(url: string): boolean;
  /** resolve a URL to canonical content identity + metadata */
  resolve(url: string): Promise<CanonicalContent | null>;
  /** fetch fresh engagement metrics (called by background workers) */
  fetchMetrics?(platformKey: string): Promise<{ views: number; likes: number; comments: number; shares: number } | null>;
}

// registry — keyed by platform name
const registry = new Map<Platform, PlatformAdapter>();

export function registerPlatformAdapter(adapter: PlatformAdapter) {
  registry.set(adapter.platform, adapter);
}

export function getPlatformAdapter(platform: Platform): PlatformAdapter | undefined {
  return registry.get(platform);
}

export function resolveAdapterForUrl(url: string): PlatformAdapter | null {
  for (const a of registry.values()) {
    if (a.matches(url)) return a;
  }
  return null;
}

export function listPlatformAdapters(): PlatformAdapter[] {
  return Array.from(registry.values());
}

"use client";

// Lightweight local identity for the no-auth prototype.
const KEY = "outrank_identity";

export interface BoostRecord {
  entityId: string;
  entityName: string;
  amount: number;
  rank: number;
  ts: number;
}

export interface Identity {
  handle: string;
  createdAt: number;
  boosts: BoostRecord[];
}

const ADJECTIVES = ["anon", "ghost", "neon", "ruby", "echo", "halo", "zed", "noir", "pixel", "volt", "wren", "cyan", "onyx", "fenn", "jett"];

function generateHandle(): string {
  return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}${Math.floor(Math.random() * 90 + 10)}`;
}

export function getIdentity(): Identity {
  if (typeof window === "undefined") return { handle: "anon", createdAt: Date.now(), boosts: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Identity;
      if (parsed.handle && parsed.createdAt) return parsed;
    }
  } catch { /* local storage is optional */ }
  const identity = { handle: generateHandle(), createdAt: Date.now(), boosts: [] };
  try { localStorage.setItem(KEY, JSON.stringify(identity)); } catch { /* optional */ }
  return identity;
}

export function recordBoost(record: BoostRecord): void {
  if (typeof window === "undefined") return;
  try {
    const identity = getIdentity();
    identity.boosts.unshift(record);
    identity.boosts = identity.boosts.slice(0, 100);
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch { /* optional */ }
}

export function getTotalBacked(): number {
  return getIdentity().boosts.reduce((sum, boost) => sum + boost.amount, 0);
}


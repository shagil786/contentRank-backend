// Redis-backed idempotency store with an in-process fallback.
import type { IdempotencyStore } from "../repositories/interfaces";
import { getRedis } from "./redis";

const local = new Map<string, { value: unknown; storedAt: number; ttlMs: number }>();

export const idempotencyStore: IdempotencyStore = {
  async get<T>(key: string): Promise<{ value: T; storedAt: number } | null> {
    const redis = await getRedis();
    if (redis) {
      try {
        const raw = await redis.get(`outrank:idempotency:${key}`);
        return raw ? JSON.parse(raw) as { value: T; storedAt: number } : null;
      } catch { /* fallback below */ }
    }
    const entry = local.get(key);
    if (!entry || Date.now() - entry.storedAt > entry.ttlMs) { local.delete(key); return null; }
    return { value: entry.value as T, storedAt: entry.storedAt };
  },
  async set(key, value, ttlMs) {
    const storedAt = Date.now();
    const redis = await getRedis();
    if (redis) {
      try { await redis.set(`outrank:idempotency:${key}`, JSON.stringify({ value, storedAt }), { PX: ttlMs }); return; }
      catch { /* fallback below */ }
    }
    local.set(key, { value, storedAt, ttlMs });
  },
};

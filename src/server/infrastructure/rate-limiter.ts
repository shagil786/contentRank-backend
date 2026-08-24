// Redis-backed token-bucket limiter with an in-process fallback for local resilience.
import { getRedis } from "./redis";

interface Bucket { tokens: number; lastRefill: number }
const buckets = new Map<string, Bucket>();
export interface RateLimitConfig { capacity: number; refillPerMs: number }
export interface RateLimitResult { ok: boolean; remaining: number; retryAfterMs: number }

const TOKEN_BUCKET_LUA = `
local tokens = tonumber(redis.call('HGET', KEYS[1], 'tokens'))
local last = tonumber(redis.call('HGET', KEYS[1], 'last'))
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill = tonumber(ARGV[3])
if not tokens or not last then tokens = capacity; last = now end
tokens = math.min(capacity, tokens + (now - last) * refill)
local allowed = 0
local retry = 0
if tokens >= 1 then tokens = tokens - 1; allowed = 1
else retry = math.ceil((1 - tokens) / refill) end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'last', now)
redis.call('EXPIRE', KEYS[1], 900)
return { allowed, math.floor(tokens), retry }
`;

function localLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(identifier);
  if (!bucket) { bucket = { tokens: config.capacity, lastRefill: now }; buckets.set(identifier, bucket); }
  bucket.tokens = Math.min(config.capacity, bucket.tokens + (now - bucket.lastRefill) * config.refillPerMs);
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) { bucket.tokens -= 1; return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 }; }
  return { ok: false, remaining: 0, retryAfterMs: Math.ceil((1 - bucket.tokens) / config.refillPerMs) };
}

export async function rateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const redis = await getRedis();
  if (!redis) return localLimit(identifier, config);
  try {
    const result = await redis.eval(TOKEN_BUCKET_LUA, { keys: [`outrank:ratelimit:${identifier}`], arguments: [String(Date.now()), String(config.capacity), String(config.refillPerMs)] }) as number[];
    return { ok: result[0] === 1, remaining: result[1], retryAfterMs: result[2] };
  } catch { return localLimit(identifier, config); }
}

export const RATE_LIMITS = {
  boost: { capacity: 20, refillPerMs: 20 / (60 * 1000) }, submit: { capacity: 10, refillPerMs: 10 / (60 * 1000) },
  search: { capacity: 60, refillPerMs: 60 / (60 * 1000) }, webhook: { capacity: 100, refillPerMs: 100 / (60 * 1000) },
  claim: { capacity: 5, refillPerMs: 5 / (60 * 60 * 1000) }, subscribe: { capacity: 5, refillPerMs: 5 / (60 * 60 * 1000) },
  general: { capacity: 120, refillPerMs: 120 / (60 * 1000) },
} as const;

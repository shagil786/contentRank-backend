// Shared Redis client for distributed infrastructure concerns.
import { createClient, type RedisClientType } from "redis";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

export async function getRedis(): Promise<RedisClientType | null> {
  if (client?.isReady) return client;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const next = createClient({ url });
      next.on("error", () => { /* callers fall back to local behavior */ });
      await next.connect();
      client = next;
      return next;
    } catch { client = null; return null; }
    finally { connecting = null; }
  })();
  return connecting;
}

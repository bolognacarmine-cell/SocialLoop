import Redis from "ioredis";
import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  redisUnavailable?: boolean;
};

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        return Math.min(times * 200, 3000);
      }
    });
    client.on("error", (error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[redis]", error.message);
      }
    });
    globalForRedis.redis = client;
  }
  return globalForRedis.redis;
}

export async function ensureRedisConnection(): Promise<Redis | null> {
  if (globalForRedis.redisUnavailable) return null;
  const client = getRedis();
  try {
    if (client.status === "wait") await client.connect();
    if (client.status !== "ready") await client.ping();
    return client;
  } catch {
    globalForRedis.redisUnavailable = true;
    return null;
  }
}

export function isRedisUnavailable() {
  return Boolean(globalForRedis.redisUnavailable);
}

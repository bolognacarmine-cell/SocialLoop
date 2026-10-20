import type { SocialPlatform } from "@prisma/client";
import { ensureRedisConnection } from "@/lib/redis";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  backend: "redis" | "memory";
};

type Counter = { count: number; resetAt: number };

const memoryStore = new Map<string, Counter>();

if (typeof setInterval === "function") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, counter] of memoryStore) {
      if (counter.resetAt <= now) memoryStore.delete(key);
    }
  }, 60_000);
  timer.unref?.();
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = memoryStore.get(key);
  const counter =
    current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };

  counter.count += 1;
  memoryStore.set(key, counter);

  return {
    allowed: counter.count <= limit,
    limit,
    remaining: Math.max(0, limit - counter.count),
    resetAt: new Date(counter.resetAt),
    backend: "memory"
  };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = await ensureRedisConnection();
  if (!redis) return memoryRateLimit(key, limit, windowMs);

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
    const ttl = await redis.pttl(key);
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: new Date(Date.now() + Math.max(ttl, 0)),
      backend: "redis"
    };
  } catch {
    return memoryRateLimit(key, limit, windowMs);
  }
}

/** Conservative per-platform publish limits, safe for demo and easy to tune. */
export const SOCIAL_RATE_LIMITS: Record<SocialPlatform, { limit: number; windowMs: number }> = {
  INSTAGRAM: { limit: 20, windowMs: 60 * 60 * 1000 },
  FACEBOOK: { limit: 30, windowMs: 60 * 60 * 1000 },
  LINKEDIN: { limit: 20, windowMs: 60 * 60 * 1000 },
  X: { limit: 50, windowMs: 15 * 60 * 1000 },
  TIKTOK: { limit: 15, windowMs: 60 * 60 * 1000 },
  YOUTUBE: { limit: 10, windowMs: 60 * 60 * 1000 }
};

export async function checkSocialRateLimit(workspaceId: string, platform: SocialPlatform) {
  const config = SOCIAL_RATE_LIMITS[platform];
  return rateLimit(`ratelimit:social:${workspaceId}:${platform}`, config.limit, config.windowMs);
}

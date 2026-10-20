import type { ConnectionOptions } from "bullmq";
import { env } from "@/lib/env";

export function getRedisConnectionOptions(): ConnectionOptions {
  const url = new URL(env.REDIS_URL);
  const db = url.pathname && url.pathname !== "/" ? Number(url.pathname.replace("/", "")) : undefined;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(db !== undefined && !Number.isNaN(db) ? { db } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

export const QUEUE_NAMES = {
  SOCIAL_PUBLISH: "social-publish",
  WORKFLOW: "workflow",
  EMAIL: "email"
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

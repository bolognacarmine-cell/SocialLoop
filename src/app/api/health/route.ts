import { prisma } from "@/lib/db";
import { ensureRedisConnection } from "@/lib/redis";
import { json, withApi } from "@/lib/api";
import { ensureEmbeddedWorker } from "@/lib/worker/embedded";

export const GET = withApi(async () => {
  // Render polls this route, so it is a reliable place to boot the embedded
  // BullMQ consumers without waiting for real user traffic.
  void ensureEmbeddedWorker();
  let database = false;
  let redis = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  const client = await ensureRedisConnection();
  if (client) {
    try {
      redis = (await client.ping()) === "PONG";
    } catch {
      redis = false;
    }
  }

  return json(
    {
      ok: database,
      service: "socialloop",
      timestamp: new Date().toISOString(),
      dependencies: { database, redis }
    },
    { status: database ? 200 : 503 }
  );
});

import { prisma } from "@/lib/db";
import { ensureRedisConnection } from "@/lib/redis";
import { json, withApi } from "@/lib/api";

export const GET = withApi(async () => {
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

import { destroySession } from "@/lib/auth/session";
import { json, withApi } from "@/lib/api";

export const POST = withApi(async () => {
  await destroySession();
  return json({ ok: true });
});

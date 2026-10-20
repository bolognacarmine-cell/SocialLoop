import { prisma } from "@/lib/db";
import { requireSession, json, withApi } from "@/lib/api";

export const GET = withApi(async () => {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      memberships: {
        include: {
          workspace: { select: { id: true, name: true, slug: true, plan: true } }
        }
      }
    }
  });
  return json({ session, user });
});

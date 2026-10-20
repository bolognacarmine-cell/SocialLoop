import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { dispatchPostTargets } from "@/lib/social/publish";

export async function assertAccountsInWorkspace(workspaceId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: ids }, workspaceId },
    select: { id: true, platform: true, status: true }
  });
  if (accounts.length !== new Set(ids).size) {
    throw new ApiError(422, "Uno o più canali social non appartengono al workspace");
  }
  const disabled = accounts.find((account) => account.status !== "CONNECTED");
  if (disabled) throw new ApiError(422, "Uno o più canali social non sono connessi");
  return accounts;
}

export async function syncPostTargets(postId: string, accountIds: string[], workspaceId: string) {
  const accounts = await assertAccountsInWorkspace(workspaceId, accountIds);
  const existing = await prisma.postTarget.findMany({ where: { postId } });
  const existingIds = new Set(existing.map((target) => target.socialAccountId));
  const nextIds = new Set(accounts.map((account) => account.id));

  await prisma.$transaction([
    prisma.postTarget.deleteMany({
      where: {
        postId,
        socialAccountId: { notIn: Array.from(nextIds) },
        status: { not: "PUBLISHED" }
      }
    }),
    ...accounts
      .filter((account) => !existingIds.has(account.id))
      .map((account) =>
        prisma.postTarget.create({
          data: {
            postId,
            socialAccountId: account.id,
            platform: account.platform
          }
        })
      )
  ]);
}

export async function maybeDispatchDuePost(postId: string, workspaceId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, workspaceId } });
  if (!post) return null;
  if (post.status !== "SCHEDULED" || !post.scheduledAt) return null;
  if (post.scheduledAt.getTime() > Date.now()) return null;
  return dispatchPostTargets(postId, workspaceId);
}

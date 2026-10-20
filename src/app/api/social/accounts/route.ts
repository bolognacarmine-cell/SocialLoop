import { prisma } from "@/lib/db";
import { json, requireWorkspace, withApi } from "@/lib/api";
import { PLATFORM_META } from "@/lib/social/registry";

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      platform: true,
      accountName: true,
      externalId: true,
      avatarUrl: true,
      status: true,
      scopes: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      createdAt: true,
      _count: { select: { postTargets: true } }
    }
  });
  return json({
    accounts: accounts.map((account) => ({
      ...account,
      platformMeta: PLATFORM_META[account.platform]
    }))
  });
});

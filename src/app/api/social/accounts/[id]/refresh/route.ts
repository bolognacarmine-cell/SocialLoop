import { prisma } from "@/lib/db";
import { ApiError, json, requireWorkspace, withApi } from "@/lib/api";
import { refreshSocialAccount } from "@/lib/social/accounts";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const account = await prisma.socialAccount.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!account) throw new ApiError(404, "Account non trovato");

  const updated = await refreshSocialAccount(account);
  return json({
    account: {
      id: updated.id,
      status: updated.status,
      tokenExpiresAt: updated.tokenExpiresAt,
      lastSyncedAt: updated.lastSyncedAt
    }
  });
});

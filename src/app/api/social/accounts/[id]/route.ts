import { prisma } from "@/lib/db";
import { ApiError, json, noContent, requireWorkspace, withApi } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();

  const account = await prisma.socialAccount.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!account) throw new ApiError(404, "Account non trovato");

  await prisma.socialAccount.delete({ where: { id: account.id } });
  return noContent();
});

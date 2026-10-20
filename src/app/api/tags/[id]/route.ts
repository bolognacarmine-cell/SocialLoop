import { prisma } from "@/lib/db";
import { ApiError, noContent, requireWorkspace, withApi } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const tag = await prisma.tag.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!tag) throw new ApiError(404, "Tag non trovato");
  await prisma.tag.delete({ where: { id } });
  return noContent();
});

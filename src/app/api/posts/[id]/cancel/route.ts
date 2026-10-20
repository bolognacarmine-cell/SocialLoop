import { prisma } from "@/lib/db";
import { ApiError, json, requireWorkspace, withApi } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const post = await prisma.post.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!post) throw new ApiError(404, "Post non trovato");
  if (post.status === "PUBLISHED") throw new ApiError(409, "Impossibile annullare un post pubblicato");

  await prisma.post.update({
    where: { id },
    data: { status: "CANCELLED", scheduledAt: null }
  });
  return json({ ok: true });
});

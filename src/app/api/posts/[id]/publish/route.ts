import { prisma } from "@/lib/db";
import { ApiError, json, requireWorkspace, withApi } from "@/lib/api";
import { dispatchPostTargets } from "@/lib/social/publish";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const post = await prisma.post.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { targets: true }
  });
  if (!post) throw new ApiError(404, "Post non trovato");
  if (post.status === "PUBLISHED") throw new ApiError(409, "Post già pubblicato");
  if (post.status === "PUBLISHING") throw new ApiError(409, "Post già in pubblicazione");

  const result = await dispatchPostTargets(id, workspace.id);
  return json({ ok: true, ...result }, { status: 202 });
});

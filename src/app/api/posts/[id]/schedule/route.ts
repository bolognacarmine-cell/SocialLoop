import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { schedulePostSchema } from "@/lib/validation/post";
import { syncPostTargets, maybeDispatchDuePost } from "@/lib/posts/service";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const post = await prisma.post.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!post) throw new ApiError(404, "Post non trovato");

  const body = await parseBody(request, schedulePostSchema);
  const scheduledAt = new Date(body.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new ApiError(422, "Data non valida");

  await syncPostTargets(id, body.socialAccountIds, workspace.id);
  await prisma.post.update({
    where: { id },
    data: { scheduledAt, status: "SCHEDULED" }
  });

  await maybeDispatchDuePost(id, workspace.id).catch(() => undefined);
  return json({ ok: true, scheduledAt, status: "SCHEDULED" });
});

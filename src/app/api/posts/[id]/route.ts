import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, noContent, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { postUpdateSchema } from "@/lib/validation/post";
import { syncPostTargets, maybeDispatchDuePost } from "@/lib/posts/service";
import { toJson } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const post = await prisma.post.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      targets: {
        include: {
          socialAccount: {
            select: { id: true, accountName: true, platform: true, avatarUrl: true, status: true }
          }
        }
      },
      campaign: true,
      author: { select: { id: true, name: true } }
    }
  });
  if (!post) throw new ApiError(404, "Post non trovato");
  return json({ post });
});

export const PATCH = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.post.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Post non trovato");
  if (existing.status === "PUBLISHING") {
    throw new ApiError(409, "Il post è in pubblicazione e non può essere modificato");
  }

  const body = await parseBody(request, postUpdateSchema);
  if (body.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, workspaceId: workspace.id }
    });
    if (!campaign) throw new ApiError(422, "Campagna non trovata");
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.campaignId !== undefined
        ? body.campaignId
          ? { campaign: { connect: { id: body.campaignId } } }
          : { campaign: { disconnect: true } }
        : {}),
      ...(body.mediaUrls !== undefined ? { mediaUrls: body.mediaUrls } : {}),
      ...(body.linkUrl !== undefined ? { linkUrl: body.linkUrl } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.metadata !== undefined ? { metadata: toJson(body.metadata) } : {})
    }
  });

  if (body.socialAccountIds !== undefined) {
    await syncPostTargets(id, body.socialAccountIds, workspace.id);
  }

  if (post.status === "SCHEDULED" && post.scheduledAt && post.scheduledAt.getTime() <= Date.now()) {
    await maybeDispatchDuePost(post.id, workspace.id).catch(() => undefined);
  }

  const updated = await prisma.post.findUnique({
    where: { id },
    include: { targets: { include: { socialAccount: true } } }
  });
  return json({ post: updated });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const post = await prisma.post.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!post) throw new ApiError(404, "Post non trovato");
  if (post.status === "PUBLISHING") throw new ApiError(409, "Post in pubblicazione");

  await prisma.post.delete({ where: { id } });
  return noContent();
});

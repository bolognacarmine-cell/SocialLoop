import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody, parseQuery, requireWorkspace, json, withApi, ApiError } from "@/lib/api";
import { postCreateSchema } from "@/lib/validation/post";
import { assertAccountsInWorkspace, maybeDispatchDuePost } from "@/lib/posts/service";
import { PostStatus } from "@prisma/client";
import { toJson } from "@/lib/utils";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(PostStatus).optional(),
  campaignId: z.string().optional(),
  search: z.string().trim().max(200).optional()
});

export const GET = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const query = parseQuery(request, querySchema);
  const where = {
    workspaceId: workspace.id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    ...(query.search
      ? { body: { contains: query.search, mode: "insensitive" as const } }
      : {})
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      include: {
        targets: {
          include: {
            socialAccount: {
              select: { id: true, accountName: true, platform: true, avatarUrl: true }
            }
          }
        },
        campaign: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } }
      },
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage
    }),
    prisma.post.count({ where })
  ]);

  return json({
    posts,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total,
      pages: Math.ceil(total / query.perPage)
    }
  });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace, session } = await requireWorkspace();
  const body = await parseBody(request, postCreateSchema);

  if (body.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, workspaceId: workspace.id }
    });
    if (!campaign) throw new ApiError(422, "Campagna non trovata");
  }
  const accounts = await assertAccountsInWorkspace(workspace.id, body.socialAccountIds);

  const post = await prisma.post.create({
    data: {
      workspaceId: workspace.id,
      authorId: session.userId,
      campaignId: body.campaignId ?? null,
      body: body.body,
      mediaUrls: body.mediaUrls,
      linkUrl: body.linkUrl,
      status: body.status,
      scheduledAt: body.scheduledAt,
      timezone: body.timezone,
      metadata: toJson(body.metadata),
      targets: {
        create: accounts.map((account) => ({
          socialAccountId: account.id,
          platform: account.platform
        }))
      }
    },
    include: { targets: true }
  });

  if (post.status === "SCHEDULED" && body.scheduledAt && body.scheduledAt.getTime() <= Date.now()) {
    await maybeDispatchDuePost(post.id, workspace.id).catch(() => undefined);
  }

  return json({ post }, { status: 201 });
});

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { retargetingAudienceCreateSchema } from "@/lib/validation/offer";
import { toJson } from "@/lib/utils";

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const audiences = await prisma.retargetingAudience.findMany({
    where: { workspaceId: workspace.id },
    include: {
      campaign: { select: { id: true, name: true } },
      _count: { select: { members: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return json({ audiences });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, retargetingAudienceCreateSchema);

  if (body.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, workspaceId: workspace.id }
    });
    if (!campaign) throw new ApiError(422, "Campagna non trovata");
  }

  const leads = body.leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: body.leadIds }, workspaceId: workspace.id },
        select: { id: true }
      })
    : [];
  if (leads.length !== new Set(body.leadIds).size) {
    throw new ApiError(422, "Uno o più lead non appartengono al workspace");
  }

  const audience = await prisma.retargetingAudience.create({
    data: {
      workspaceId: workspace.id,
      name: body.name,
      platform: body.platform ?? null,
      campaignId: body.campaignId ?? null,
      filter: toJson(body.filter),
      members: {
        create: leads.map((lead) => ({ leadId: lead.id }))
      }
    },
    include: { _count: { select: { members: true } } }
  });

  return json({ audience }, { status: 201 });
});

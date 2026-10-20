import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, noContent, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { campaignUpdateSchema } from "@/lib/validation/campaign";

type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      posts: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { targets: true }
      },
      _count: { select: { leads: true, conversions: true, posts: true } },
      conversions: { select: { valueCents: true } }
    }
  });
  if (!campaign) throw new ApiError(404, "Campagna non trovata");
  return json({
    campaign: {
      ...campaign,
      revenueCents: campaign.conversions.reduce((sum, conversion) => sum + conversion.valueCents, 0)
    }
  });
});

export const PATCH = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.campaign.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Campagna non trovata");
  const body = await parseBody(request, campaignUpdateSchema);
  const campaign = await prisma.campaign.update({ where: { id }, data: body });
  return json({ campaign });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.campaign.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Campagna non trovata");
  await prisma.campaign.delete({ where: { id } });
  return noContent();
});

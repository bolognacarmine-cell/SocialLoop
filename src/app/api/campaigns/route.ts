import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { campaignCreateSchema } from "@/lib/validation/campaign";

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: { select: { posts: true, leads: true, conversions: true } },
      conversions: { select: { valueCents: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return json({
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      revenueCents: campaign.conversions.reduce((sum, conversion) => sum + conversion.valueCents, 0)
    }))
  });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, campaignCreateSchema);
  const campaign = await prisma.campaign.create({
    data: { ...body, workspaceId: workspace.id }
  });
  return json({ campaign }, { status: 201 });
});

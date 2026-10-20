import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { offerCreateSchema } from "@/lib/validation/offer";

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const offers = await prisma.offer.findMany({
    where: { workspaceId: workspace.id },
    include: {
      campaign: { select: { id: true, name: true } },
      _count: { select: { conversions: true } },
      conversions: { select: { valueCents: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return json({
    offers: offers.map((offer) => ({
      ...offer,
      revenueCents: offer.conversions.reduce((sum, conversion) => sum + conversion.valueCents, 0)
    }))
  });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, offerCreateSchema);
  if (body.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, workspaceId: workspace.id }
    });
    if (!campaign) throw new ApiError(422, "Campagna non trovata");
  }
  const offer = await prisma.offer.create({
    data: {
      workspaceId: workspace.id,
      campaignId: body.campaignId ?? null,
      name: body.name,
      description: body.description ?? null,
      priceCents: body.priceCents,
      currency: body.currency.toUpperCase(),
      checkoutUrl: body.checkoutUrl ?? null,
      active: body.active
    }
  });
  return json({ offer }, { status: 201 });
});

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, noContent, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { offerUpdateSchema } from "@/lib/validation/offer";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.offer.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Offerta non trovata");
  const body = await parseBody(request, offerUpdateSchema);
  const offer = await prisma.offer.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.campaignId !== undefined ? { campaignId: body.campaignId } : {}),
      ...(body.priceCents !== undefined ? { priceCents: body.priceCents } : {}),
      ...(body.currency !== undefined ? { currency: body.currency.toUpperCase() } : {}),
      ...(body.checkoutUrl !== undefined ? { checkoutUrl: body.checkoutUrl } : {}),
      ...(body.active !== undefined ? { active: body.active } : {})
    }
  });
  return json({ offer });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.offer.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Offerta non trovata");
  await prisma.offer.delete({ where: { id } });
  return noContent();
});

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, parseQuery, requireWorkspace, withApi } from "@/lib/api";
import { conversionCreateSchema } from "@/lib/validation/offer";
import { applyLeadScore, SCORE_POINTS } from "@/lib/leads/scoring";
import { toJson } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { syncLeadSegments } from "@/lib/leads/segments";
import { triggerWorkflows } from "@/lib/workflows/engine";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  campaignId: z.string().optional()
});

export const GET = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const query = parseQuery(request, querySchema);
  const where = {
    workspaceId: workspace.id,
    ...(query.campaignId ? { campaignId: query.campaignId } : {})
  };
  const [conversions, total] = await Promise.all([
    prisma.conversion.findMany({
      where,
      include: {
        lead: { select: { id: true, email: true, name: true } },
        offer: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } }
      },
      orderBy: { occurredAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage
    }),
    prisma.conversion.count({ where })
  ]);
  return json({ conversions, pagination: { page: query.page, perPage: query.perPage, total } });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, conversionCreateSchema);

  const [lead, offer, campaign] = await Promise.all([
    body.leadId
      ? prisma.lead.findFirst({ where: { id: body.leadId, workspaceId: workspace.id } })
      : null,
    body.offerId
      ? prisma.offer.findFirst({ where: { id: body.offerId, workspaceId: workspace.id } })
      : null,
    body.campaignId
      ? prisma.campaign.findFirst({ where: { id: body.campaignId, workspaceId: workspace.id } })
      : null
  ]);

  if (body.leadId && !lead) throw new ApiError(422, "Lead non trovato");
  if (body.offerId && !offer) throw new ApiError(422, "Offerta non trovata");
  if (body.campaignId && !campaign) throw new ApiError(422, "Campagna non trovata");

  const valueCents = body.valueCents || offer?.priceCents || 0;
  const campaignId = body.campaignId ?? offer?.campaignId ?? lead?.campaignId ?? null;

  const conversion = await prisma.conversion.create({
    data: {
      workspaceId: workspace.id,
      leadId: lead?.id ?? null,
      offerId: offer?.id ?? null,
      campaignId,
      valueCents,
      currency: (body.currency || offer?.currency || "EUR").toUpperCase(),
      occurredAt: body.occurredAt ?? new Date(),
      metadata: toJson(body.metadata)
    },
    include: { lead: true, offer: true, campaign: true }
  });

  if (lead) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { stage: "WON", lastActivityAt: new Date() }
    });
    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        type: "CONVERSION",
        name: offer?.name ?? "Conversione",
        metadata: { conversionId: conversion.id, valueCents }
      }
    });
    await applyLeadScore(lead.id, SCORE_POINTS.CONVERSION, "Conversion", {
      conversionId: conversion.id
    }).catch(() => undefined);
    await syncLeadSegments(lead.id).catch(() => undefined);
  }

  await trackEvent({
    workspaceId: workspace.id,
    type: "CONVERSION",
    name: offer?.name ?? "Conversion",
    leadId: lead?.id ?? null,
    campaignId,
    offerId: offer?.id ?? null,
    value: valueCents / 100,
    currency: conversion.currency,
    metadata: { conversionId: conversion.id }
  });

  await triggerWorkflows({
    workspaceId: workspace.id,
    triggerType: "CONVERSION",
    leadId: lead?.id ?? null,
    context: {
      conversionId: conversion.id,
      valueCents,
      offerId: offer?.id ?? null,
      campaignId
    }
  }).catch(() => undefined);

  return json({ conversion }, { status: 201 });
});

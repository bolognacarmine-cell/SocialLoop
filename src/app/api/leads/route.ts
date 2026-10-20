import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, parseQuery, requireWorkspace, withApi } from "@/lib/api";
import { leadCreateSchema, leadQuerySchema } from "@/lib/validation/lead";
import { calculateInitialScore } from "@/lib/leads/scoring";
import { trackEvent } from "@/lib/analytics";
import { syncLeadSegments } from "@/lib/leads/segments";
import { triggerWorkflows } from "@/lib/workflows/engine";
import { toJson } from "@/lib/utils";

export const GET = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const query = parseQuery(request, leadQuerySchema);

  const where = {
    workspaceId: workspace.id,
    ...(query.stage ? { stage: query.stage } : {}),
    ...(query.minScore ? { score: { gte: query.minScore } } : {}),
    ...(query.campaignId ? { campaignId: query.campaignId } : {}),
    ...(query.tag ? { tags: { some: { tag: { name: query.tag } } } } : {}),
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" as const } },
            { name: { contains: query.search, mode: "insensitive" as const } },
            { company: { contains: query.search, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
        campaign: { select: { id: true, name: true } },
        landingPage: { select: { id: true, name: true, slug: true } },
        _count: { select: { conversions: true, emailSends: true, submissions: true } }
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.perPage,
      take: query.perPage
    }),
    prisma.lead.count({ where })
  ]);

  return json({
    leads,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total,
      pages: Math.ceil(total / query.perPage)
    }
  });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, leadCreateSchema);

  const duplicate = await prisma.lead.findUnique({
    where: { workspaceId_email: { workspaceId: workspace.id, email: body.email } }
  });
  if (duplicate) throw new ApiError(409, "Esiste già un lead con questa email");

  if (body.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, workspaceId: workspace.id }
    });
    if (!campaign) throw new ApiError(422, "Campagna non trovata");
  }

  const lead = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      email: body.email,
      name: body.name ?? null,
      phone: body.phone ?? null,
      company: body.company ?? null,
      jobTitle: body.jobTitle ?? null,
      stage: body.stage,
      source: body.source,
      campaignId: body.campaignId ?? null,
      landingPageId: body.landingPageId ?? null,
      socialPostId: body.socialPostId ?? null,
      consent: body.consent,
      utm: body.utm,
      customFields: toJson(body.customFields),
      score: calculateInitialScore({
        email: body.email,
        name: body.name,
        phone: body.phone,
        company: body.company,
        jobTitle: body.jobTitle,
        source: body.source
      }),
      lastActivityAt: new Date(),
      tags: {
        create: await Promise.all(
          body.tags.map(async (name) => {
            const tag = await prisma.tag.upsert({
              where: { workspaceId_name: { workspaceId: workspace.id, name } },
              create: { workspaceId: workspace.id, name },
              update: {}
            });
            return { tagId: tag.id };
          })
        )
      }
    },
    include: { tags: { include: { tag: true } } }
  });

  await trackEvent({
    workspaceId: workspace.id,
    type: "LEAD_CREATED",
    name: "Manual lead",
    leadId: lead.id,
    campaignId: lead.campaignId,
    landingPageId: lead.landingPageId,
    metadata: { source: body.source }
  });

  await syncLeadSegments(lead.id).catch(() => undefined);
  await triggerWorkflows({
    workspaceId: workspace.id,
    triggerType: "LEAD_CREATED",
    leadId: lead.id,
    context: { source: body.source }
  }).catch(() => undefined);

  return json({ lead }, { status: 201 });
});

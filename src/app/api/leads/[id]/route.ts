import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, noContent, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { leadUpdateSchema } from "@/lib/validation/lead";
import { applyLeadScore } from "@/lib/leads/scoring";
import { syncLeadSegments } from "@/lib/leads/segments";
import { triggerWorkflows } from "@/lib/workflows/engine";
import { toJson } from "@/lib/utils";

type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const lead = await prisma.lead.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      tags: { include: { tag: true } },
      campaign: { select: { id: true, name: true } },
      landingPage: { select: { id: true, name: true, slug: true } },
      socialPost: { select: { id: true, body: true, publishedAt: true } },
      events: { orderBy: { occurredAt: "desc" }, take: 50 },
      scoreEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      submissions: { orderBy: { createdAt: "desc" }, take: 20, include: { form: true } },
      emailSends: { orderBy: { createdAt: "desc" }, take: 20, include: { template: true } },
      conversions: { orderBy: { occurredAt: "desc" }, include: { offer: true } },
      segments: { include: { segment: true } },
      workflowRuns: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { workflow: { select: { id: true, name: true } } }
      },
      retargetingMemberships: { include: { audience: true } }
    }
  });
  if (!lead) throw new ApiError(404, "Lead non trovato");
  return json({ lead });
});

export const PATCH = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.lead.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Lead non trovato");

  const body = await parseBody(request, leadUpdateSchema);

  if (body.score !== undefined && body.score !== existing.score) {
    await applyLeadScore(id, body.score - existing.score, "Manual score adjustment");
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.company !== undefined ? { company: body.company } : {}),
      ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle } : {}),
      ...(body.stage !== undefined ? { stage: body.stage } : {}),
      ...(body.consent !== undefined ? { consent: body.consent } : {}),
      ...(body.customFields !== undefined ? { customFields: toJson(body.customFields) } : {}),
      ...(body.stage !== undefined && body.stage !== existing.stage
        ? { lastActivityAt: new Date() }
        : {})
    },
    include: { tags: { include: { tag: true } } }
  });

  if (body.stage && body.stage !== existing.stage) {
    await prisma.leadEvent.create({
      data: {
        leadId: id,
        type: "STAGE_CHANGED",
        name: body.stage,
        metadata: { from: existing.stage, to: body.stage }
      }
    });
    await triggerWorkflows({
      workspaceId: workspace.id,
      triggerType: "LEAD_STAGE_CHANGED",
      leadId: id,
      context: { stage: body.stage, previousStage: existing.stage }
    }).catch(() => undefined);
  }

  await syncLeadSegments(id).catch(() => undefined);
  return json({ lead });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.lead.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Lead non trovato");
  await prisma.lead.delete({ where: { id } });
  return noContent();
});

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, parseQuery, requireWorkspace, withApi } from "@/lib/api";
import { leadTagSchema } from "@/lib/validation/lead";
import { syncLeadSegments } from "@/lib/leads/segments";
import { triggerWorkflows } from "@/lib/workflows/engine";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const lead = await prisma.lead.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!lead) throw new ApiError(404, "Lead non trovato");

  const body = await parseBody(request, leadTagSchema);
  const tag = await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: body.tag } },
    create: {
      workspaceId: workspace.id,
      name: body.tag,
      color: body.color ?? "#338fff"
    },
    update: body.color ? { color: body.color } : {}
  });

  await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } },
    create: { leadId: lead.id, tagId: tag.id },
    update: {}
  });
  await prisma.leadEvent.create({
    data: { leadId: lead.id, type: "TAG_ADDED", name: tag.name }
  });
  await syncLeadSegments(lead.id).catch(() => undefined);
  await triggerWorkflows({
    workspaceId: workspace.id,
    triggerType: "TAG_ADDED",
    leadId: lead.id,
    context: { tag: tag.name }
  }).catch(() => undefined);

  return json({ tag }, { status: 201 });
});

const deleteQuerySchema = z.object({
  tag: z.string().min(1)
});

export const DELETE = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const lead = await prisma.lead.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!lead) throw new ApiError(404, "Lead non trovato");

  const query = parseQuery(request, deleteQuerySchema);
  const tag = await prisma.tag.findUnique({
    where: { workspaceId_name: { workspaceId: workspace.id, name: query.tag } }
  });
  if (!tag) throw new ApiError(404, "Tag non trovato");

  await prisma.leadTag
    .delete({ where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } } })
    .catch(() => undefined);
  await prisma.leadEvent.create({
    data: { leadId: lead.id, type: "TAG_REMOVED", name: tag.name }
  });
  await syncLeadSegments(lead.id).catch(() => undefined);
  return json({ ok: true });
});

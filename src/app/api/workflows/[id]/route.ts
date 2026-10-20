import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, noContent, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { workflowUpdateSchema } from "@/lib/validation/workflow";

type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const workflow = await prisma.workflow.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          lead: { select: { id: true, email: true, name: true, score: true } },
          steps: true
        }
      },
      _count: { select: { runs: true } }
    }
  });
  if (!workflow) throw new ApiError(404, "Workflow non trovato");
  return json({ workflow });
});

export const PATCH = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.workflow.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Workflow non trovato");
  const body = await parseBody(request, workflowUpdateSchema);
  const workflow = await prisma.workflow.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.triggerType !== undefined ? { triggerType: body.triggerType } : {}),
      ...(body.triggerConfig !== undefined
        ? { triggerConfig: body.triggerConfig as object }
        : {}),
      ...(body.steps !== undefined ? { steps: body.steps as object } : {})
    }
  });
  return json({ workflow });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.workflow.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Workflow non trovato");
  await prisma.workflow.delete({ where: { id } });
  return noContent();
});

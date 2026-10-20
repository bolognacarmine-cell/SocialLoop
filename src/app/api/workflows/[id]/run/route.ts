import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { workflowRunSchema } from "@/lib/validation/workflow";
import { enqueueWorkflow } from "@/lib/queue/queues";
import { buildLeadContext } from "@/lib/workflows/context";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const workflow = await prisma.workflow.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!workflow) throw new ApiError(404, "Workflow non trovato");

  const body = await parseBody(request, workflowRunSchema);
  if (body.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, workspaceId: workspace.id }
    });
    if (!lead) throw new ApiError(404, "Lead non trovato");
  }

  const leadContext = body.leadId ? await buildLeadContext(body.leadId) : null;
  const run = await prisma.workflowRun.create({
    data: {
      workspaceId: workspace.id,
      workflowId: workflow.id,
      leadId: body.leadId ?? null,
      status: "PENDING",
      context: {
        ...(leadContext ?? {}),
        manual: true
      } as object
    }
  });
  await enqueueWorkflow({ workspaceId: workspace.id, workflowRunId: run.id });

  return json({ run }, { status: 202 });
});

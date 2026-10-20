import type { WorkflowTriggerType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueueWorkflow } from "@/lib/queue/queues";
import { getErrorMessage } from "@/lib/utils";
import { buildLeadContext, leadToContext } from "./context";
import { workflowTriggerMatches } from "./conditions";
import type { TriggerConfig, WorkflowContext } from "./types";

export type TriggerWorkflowsInput = {
  workspaceId: string;
  triggerType: WorkflowTriggerType;
  leadId?: string | null;
  context?: Record<string, unknown>;
};

export async function triggerWorkflows({
  workspaceId,
  triggerType,
  leadId,
  context = {}
}: TriggerWorkflowsInput) {
  const workflows = await prisma.workflow.findMany({
    where: { workspaceId, status: "ACTIVE", triggerType }
  });
  if (workflows.length === 0) return [];

  const leadContext = leadId ? await buildLeadContext(leadId) : null;
  const data: WorkflowContext = { ...context, ...(leadContext ?? {}) };

  const runs = [];
  for (const workflow of workflows) {
    if (!workflowTriggerMatches(workflow.triggerConfig as TriggerConfig, data)) continue;

    const run = await prisma.workflowRun.create({
      data: {
        workspaceId,
        workflowId: workflow.id,
        leadId: leadId ?? null,
        status: "PENDING",
        context: {
          ...context,
          ...(leadContext ?? {})
        } as object
      }
    });

    try {
      await enqueueWorkflow({ workspaceId, workflowRunId: run.id });
      runs.push(run);
    } catch (error) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "FAILED", error: getErrorMessage(error), finishedAt: new Date() }
      });
    }
  }

  return runs;
}

export async function triggerWorkflowsForLead(
  workspaceId: string,
  leadId: string,
  triggerType: WorkflowTriggerType,
  context: Record<string, unknown> = {}
) {
  return triggerWorkflows({ workspaceId, triggerType, leadId, context });
}

export { leadToContext };

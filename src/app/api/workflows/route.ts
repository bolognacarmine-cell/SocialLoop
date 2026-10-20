import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { workflowCreateSchema } from "@/lib/validation/workflow";

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const workflows = await prisma.workflow.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: { select: { runs: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
  return json({ workflows });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace, session } = await requireWorkspace();
  const body = await parseBody(request, workflowCreateSchema);
  const workflow = await prisma.workflow.create({
    data: {
      workspaceId: workspace.id,
      createdById: session.userId,
      name: body.name,
      description: body.description ?? null,
      status: body.status,
      triggerType: body.triggerType,
      triggerConfig: body.triggerConfig as object,
      steps: body.steps as object
    }
  });
  return json({ workflow }, { status: 201 });
});

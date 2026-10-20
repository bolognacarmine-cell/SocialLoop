import { prisma } from "@/lib/db";
import { ApiError, json, requireWorkspace, withApi } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const run = await prisma.workflowRun.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      workflow: true,
      lead: { select: { id: true, email: true, name: true, score: true, stage: true } },
      steps: { orderBy: { stepIndex: "asc" } },
      emailSends: true
    }
  });
  if (!run) throw new ApiError(404, "Run non trovato");
  return json({ run });
});

import { prisma } from "@/lib/db";
import { ApiError, json, noContent, requireWorkspace, withApi } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const audience = await prisma.retargetingAudience.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      members: {
        include: {
          lead: { select: { id: true, email: true, name: true, score: true, stage: true } }
        }
      },
      campaign: { select: { id: true, name: true } }
    }
  });
  if (!audience) throw new ApiError(404, "Audience non trovata");
  return json({ audience });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const audience = await prisma.retargetingAudience.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!audience) throw new ApiError(404, "Audience non trovata");
  await prisma.retargetingAudience.delete({ where: { id } });
  return noContent();
});

import { prisma } from "@/lib/db";
import { ApiError, json, requireWorkspace, withApi } from "@/lib/api";
import { syncSegment } from "@/lib/leads/segments";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const segment = await prisma.segment.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!segment) throw new ApiError(404, "Segmento non trovato");
  const result = await syncSegment(id);
  return json({ ok: true, members: result.count });
});

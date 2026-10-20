import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { segmentCreateSchema } from "@/lib/validation/segment";
import { syncSegment } from "@/lib/leads/segments";

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const segments = await prisma.segment.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" }
  });
  return json({ segments });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, segmentCreateSchema);
  const duplicate = await prisma.segment.findUnique({
    where: { workspaceId_name: { workspaceId: workspace.id, name: body.name } }
  });
  if (duplicate) throw new ApiError(409, "Esiste già un segmento con questo nome");

  const segment = await prisma.segment.create({
    data: {
      workspaceId: workspace.id,
      name: body.name,
      description: body.description ?? null,
      rules: body.rules as object
    }
  });
  const result = await syncSegment(segment.id).catch(() => ({ count: 0 }));
  return json({ segment, members: result.count }, { status: 201 });
});

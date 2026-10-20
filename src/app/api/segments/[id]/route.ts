import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, noContent, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { segmentUpdateSchema } from "@/lib/validation/segment";
import { syncSegment } from "@/lib/leads/segments";

type Context = { params: Promise<{ id: string }> };

export const GET = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const segment = await prisma.segment.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      members: {
        take: 20,
        include: { lead: { select: { id: true, email: true, name: true, score: true, stage: true } } }
      },
      _count: { select: { members: true } }
    }
  });
  if (!segment) throw new ApiError(404, "Segmento non trovato");
  return json({ segment });
});

export const PATCH = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.segment.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Segmento non trovato");
  const body = await parseBody(request, segmentUpdateSchema);
  const segment = await prisma.segment.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.rules !== undefined ? { rules: body.rules as object } : {})
    }
  });
  if (body.rules) await syncSegment(id).catch(() => undefined);
  return json({ segment });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.segment.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, "Segmento non trovato");
  await prisma.segment.delete({ where: { id } });
  return noContent();
});

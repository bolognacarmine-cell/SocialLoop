import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, parseBody, requireWorkspace, withApi } from "@/lib/api";

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const tags = await prisma.tag.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { leads: true } } },
    orderBy: { name: "asc" }
  });
  return json({ tags });
});

const tagSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#338fff")
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, tagSchema);
  const tag = await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: body.name } },
    create: { workspaceId: workspace.id, name: body.name, color: body.color },
    update: { color: body.color }
  });
  return json({ tag }, { status: 201 });
});

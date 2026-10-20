import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, requireWorkspace, withApi } from "@/lib/api";

type Context = { params: Promise<{ id: string }> };

const toggleSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional()
});

export const POST = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const workflow = await prisma.workflow.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!workflow) throw new ApiError(404, "Workflow non trovato");

  let body: z.infer<typeof toggleSchema> = {};
  try {
    body = await parseBody(request, toggleSchema);
  } catch {
    body = {};
  }

  const nextStatus =
    body.status ?? (workflow.status === "ACTIVE" ? "PAUSED" : "ACTIVE");

  const updated = await prisma.workflow.update({
    where: { id },
    data: { status: nextStatus }
  });
  return json({ workflow: updated });
});

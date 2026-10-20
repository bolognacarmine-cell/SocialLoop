import type { NextRequest } from "next/server";
import { z } from "zod";
import { WorkflowRunStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, parseQuery, requireWorkspace, withApi } from "@/lib/api";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  status: z.nativeEnum(WorkflowRunStatus).optional(),
  workflowId: z.string().optional()
});

export const GET = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const query = parseQuery(request, querySchema);
  const where = {
    workspaceId: workspace.id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.workflowId ? { workflowId: query.workflowId } : {})
  };
  const [runs, total] = await Promise.all([
    prisma.workflowRun.findMany({
      where,
      include: {
        workflow: { select: { id: true, name: true, triggerType: true } },
        lead: { select: { id: true, email: true, name: true } },
        _count: { select: { steps: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage
    }),
    prisma.workflowRun.count({ where })
  ]);
  return json({ runs, pagination: { page: query.page, perPage: query.perPage, total } });
});

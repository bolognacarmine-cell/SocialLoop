import type { NextRequest } from "next/server";
import { z } from "zod";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, parseQuery, requireWorkspace, withApi } from "@/lib/api";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
  status: z.nativeEnum(JobStatus).optional(),
  queue: z.string().optional(),
  search: z.string().trim().max(100).optional()
});

export const GET = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const query = parseQuery(request, querySchema);
  const where = {
    workspaceId: workspace.id,
    ...(query.status ? { status: query.status } : {}),
    ...(query.queue ? { queue: query.queue } : {}),
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {})
  };
  const [jobs, total] = await Promise.all([
    prisma.jobLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage
    }),
    prisma.jobLog.count({ where })
  ]);
  return json({ jobs, pagination: { page: query.page, perPage: query.perPage, total } });
});

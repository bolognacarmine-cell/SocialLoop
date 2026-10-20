import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseBody, requireSession, json, withApi } from "@/lib/api";
import { slugify } from "@/lib/utils";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export const GET = withApi(async () => {
  const session = await requireSession();
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" }
  });
  return json({
    activeWorkspaceId: session.workspaceId,
    workspaces: memberships.map((membership) => ({
      ...membership.workspace,
      role: membership.role
    }))
  });
});

export const POST = withApi(async (request: NextRequest) => {
  const session = await requireSession();
  const body = await parseBody(request, createWorkspaceSchema);
  const slug = `${slugify(body.name) || "workspace"}-${Math.random().toString(36).slice(2, 6)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name: body.name,
      slug,
      ownerId: session.userId,
      memberships: {
        create: { userId: session.userId, role: "OWNER" }
      }
    }
  });
  return json({ workspace }, { status: 201 });
});

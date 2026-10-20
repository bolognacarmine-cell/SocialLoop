import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { appendSessionCookie, createSession } from "@/lib/auth/session";
import { ApiError, json, withApi } from "@/lib/api";
import { loginSchema } from "@/lib/validation/auth";

export const POST = withApi(async (request: NextRequest) => {
  const body = loginSchema.parse(await request.json());

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!user) throw new ApiError(401, "Credenziali non valide");
  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Credenziali non valide");

  const membership = user.memberships[0];
  if (!membership) throw new ApiError(403, "Nessun workspace associato all'account");

  const token = await createSession({
    userId: user.id,
    workspaceId: membership.workspaceId,
    email: user.email,
    name: user.name
  });

  const response = json({
    user: { id: user.id, email: user.email, name: user.name },
    workspace: membership.workspace,
    workspaces: user.memberships.map((item) => ({
      id: item.workspace.id,
      name: item.workspace.name,
      slug: item.workspace.slug,
      role: item.role
    }))
  });
  return appendSessionCookie(response, token);
});

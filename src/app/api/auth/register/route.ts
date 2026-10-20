import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { appendSessionCookie, createSession } from "@/lib/auth/session";
import { ApiError, json, withApi } from "@/lib/api";
import { registerSchema } from "@/lib/validation/auth";
import { slugify } from "@/lib/utils";

export const POST = withApi(async (request: NextRequest) => {
  const body = registerSchema.parse(await request.json());

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ApiError(409, "Esiste già un account con questa email");

  const passwordHash = await hashPassword(body.password);
  const baseSlug = slugify(body.workspaceName) || "workspace";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, passwordHash }
    });

    const workspace = await prisma.workspace.create({
      data: {
        name: body.workspaceName,
        slug,
        plan: "FREE",
        ownerId: user.id,
        memberships: { create: { userId: user.id, role: "OWNER" } }
      }
    });

    const token = await createSession({
      userId: user.id,
      workspaceId: workspace.id,
      email: user.email,
      name: user.name
    });

    const response = json({
      user: { id: user.id, email: user.email, name: user.name },
      workspace
    });
    return appendSessionCookie(response, token);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(409, "Email o workspace già in uso");
    }
    throw error;
  }
});

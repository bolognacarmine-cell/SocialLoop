import { prisma } from "@/lib/db";
import { ApiError, json, requireSession, withApi } from "@/lib/api";
import { appendSessionCookie } from "@/lib/auth/session";
import { signSessionToken } from "@/lib/auth/jwt";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const session = await requireSession();
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.userId, workspaceId: id } },
    include: { workspace: true }
  });
  if (!membership) throw new ApiError(403, "Workspace non accessibile");

  const token = await signSessionToken({
    userId: session.userId,
    workspaceId: membership.workspaceId,
    email: session.email,
    name: session.name
  });

  const response = json({ workspace: membership.workspace });
  return appendSessionCookie(response, token);
});

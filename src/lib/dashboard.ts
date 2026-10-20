import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function requireDashboardSession() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [workspace, memberships] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: session.workspaceId } }),
    prisma.membership.findMany({
      where: { userId: session.userId },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "asc" }
    })
  ]);

  if (!workspace) redirect("/login");

  return {
    session,
    workspace,
    workspaces: memberships.map((membership) => ({
      id: membership.workspaceId,
      name: membership.workspace.name,
      role: membership.role
    }))
  };
}

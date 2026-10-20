import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { json, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { emailTemplateCreateSchema } from "@/lib/validation/email";

export const GET = withApi(async () => {
  const { workspace } = await requireWorkspace();
  const templates = await prisma.emailTemplate.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { sends: true } } },
    orderBy: { updatedAt: "desc" }
  });
  return json({ templates });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, emailTemplateCreateSchema);
  const template = await prisma.emailTemplate.create({
    data: {
      workspaceId: workspace.id,
      name: body.name,
      subject: body.subject,
      html: body.html,
      text: body.text ?? null
    }
  });
  return json({ template }, { status: 201 });
});

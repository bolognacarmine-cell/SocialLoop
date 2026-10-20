import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, json, noContent, parseBody, requireWorkspace, withApi } from "@/lib/api";
import { emailTemplateUpdateSchema } from "@/lib/validation/email";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withApi<Context>(async (request: NextRequest, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.emailTemplate.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!existing) throw new ApiError(404, "Template non trovato");
  const body = await parseBody(request, emailTemplateUpdateSchema);
  const template = await prisma.emailTemplate.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.subject !== undefined ? { subject: body.subject } : {}),
      ...(body.html !== undefined ? { html: body.html } : {}),
      ...(body.text !== undefined ? { text: body.text } : {})
    }
  });
  return json({ template });
});

export const DELETE = withApi<Context>(async (_request, { params }) => {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const existing = await prisma.emailTemplate.findFirst({
    where: { id, workspaceId: workspace.id }
  });
  if (!existing) throw new ApiError(404, "Template non trovato");
  await prisma.emailTemplate.delete({ where: { id } });
  return noContent();
});

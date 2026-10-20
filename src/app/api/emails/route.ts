import type { NextRequest } from "next/server";
import { z } from "zod";
import { EmailStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, json, parseBody, parseQuery, requireWorkspace, withApi } from "@/lib/api";
import { sendTestEmailSchema } from "@/lib/validation/email";
import { enqueueEmail } from "@/lib/queue/queues";
import { getErrorMessage } from "@/lib/utils";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  status: z.nativeEnum(EmailStatus).optional()
});

export const GET = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const query = parseQuery(request, querySchema);
  const where = {
    workspaceId: workspace.id,
    ...(query.status ? { status: query.status } : {})
  };
  const [emails, total] = await Promise.all([
    prisma.emailSend.findMany({
      where,
      include: {
        lead: { select: { id: true, email: true, name: true } },
        template: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.perPage,
      take: query.perPage
    }),
    prisma.emailSend.count({ where })
  ]);
  return json({ emails, pagination: { page: query.page, perPage: query.perPage, total } });
});

export const POST = withApi(async (request: NextRequest) => {
  const { workspace } = await requireWorkspace();
  const body = await parseBody(request, sendTestEmailSchema);

  const template = await prisma.emailTemplate.findFirst({
    where: { id: body.templateId, workspaceId: workspace.id }
  });
  if (!template) throw new ApiError(404, "Template non trovato");

  if (body.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, workspaceId: workspace.id }
    });
    if (!lead) throw new ApiError(404, "Lead non trovato");
  }

  const send = await prisma.emailSend.create({
    data: {
      workspaceId: workspace.id,
      leadId: body.leadId ?? null,
      templateId: template.id,
      toEmail: body.to,
      subject: template.subject,
      html: template.html,
      status: "QUEUED"
    }
  });

  try {
    await enqueueEmail({ workspaceId: workspace.id, emailSendId: send.id });
  } catch (error) {
    await prisma.emailSend.update({
      where: { id: send.id },
      data: { status: "FAILED", error: getErrorMessage(error) }
    });
    throw error;
  }

  return json({ email: send }, { status: 202 });
});

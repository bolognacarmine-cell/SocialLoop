import { z } from "zod";

export const emailTemplateCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(2).max(200),
  html: z.string().min(10).max(200000),
  text: z.string().max(100000).optional().nullable()
});

export const emailTemplateUpdateSchema = emailTemplateCreateSchema.partial();

export const sendTestEmailSchema = z.object({
  to: z.string().email(),
  templateId: z.string().min(1),
  leadId: z.string().optional()
});

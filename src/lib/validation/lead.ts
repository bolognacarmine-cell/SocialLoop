import { z } from "zod";
import { LeadSource, LeadStage } from "@prisma/client";
import { emailSchema } from "./common";

export const leadStageSchema = z.nativeEnum(LeadStage);
export const leadSourceSchema = z.nativeEnum(LeadSource);

export const leadCreateSchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  company: z.string().trim().max(120).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  stage: leadStageSchema.default("NEW"),
  source: leadSourceSchema.default("MANUAL"),
  campaignId: z.string().optional().nullable(),
  landingPageId: z.string().optional().nullable(),
  socialPostId: z.string().optional().nullable(),
  consent: z.boolean().default(true),
  utm: z.record(z.string()).default({}),
  customFields: z.record(z.unknown()).default({}),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([])
});

export const leadUpdateSchema = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  stage: leadStageSchema.optional(),
  consent: z.boolean().optional(),
  customFields: z.record(z.unknown()).optional(),
  score: z.coerce.number().int().min(0).max(1000).optional()
});

export const leadTagSchema = z.object({
  tag: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

export const publicLeadSubmissionSchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  consent: z.boolean().default(true),
  fields: z.record(z.union([z.string(), z.boolean(), z.number(), z.null()])).default({}),
  utm: z.record(z.string()).default({}),
  campaignId: z.string().optional(),
  socialPostId: z.string().optional()
});

export const leadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  stage: leadStageSchema.optional(),
  minScore: z.coerce.number().int().min(0).optional(),
  tag: z.string().optional(),
  campaignId: z.string().optional()
});

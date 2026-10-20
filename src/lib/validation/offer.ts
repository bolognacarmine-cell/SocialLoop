import { z } from "zod";

export const offerCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  campaignId: z.string().optional().nullable(),
  priceCents: z.coerce.number().int().min(0).default(0),
  currency: z.string().length(3).default("EUR"),
  checkoutUrl: z.string().url().optional().nullable(),
  active: z.boolean().default(true)
});

export const offerUpdateSchema = offerCreateSchema.partial();

export const conversionCreateSchema = z.object({
  leadId: z.string().optional().nullable(),
  offerId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  valueCents: z.coerce.number().int().min(0).default(0),
  currency: z.string().length(3).default("EUR"),
  metadata: z.record(z.unknown()).default({}),
  occurredAt: z.coerce.date().optional()
});

export const retargetingAudienceCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "LINKEDIN", "X", "TIKTOK", "YOUTUBE"]).optional(),
  campaignId: z.string().optional().nullable(),
  filter: z.record(z.unknown()).default({}),
  leadIds: z.array(z.string()).default([])
});

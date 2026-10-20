import { z } from "zod";
import { CampaignStatus } from "@prisma/client";

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.nativeEnum(CampaignStatus).default("DRAFT"),
  startAt: z.coerce.date().optional().nullable(),
  endAt: z.coerce.date().optional().nullable(),
  budgetCents: z.coerce.number().int().min(0).optional().nullable(),
  utmSource: z.string().max(80).optional().nullable(),
  utmMedium: z.string().max(80).optional().nullable(),
  utmCampaign: z.string().max(80).optional().nullable()
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

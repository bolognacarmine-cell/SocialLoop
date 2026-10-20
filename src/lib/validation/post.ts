import { z } from "zod";
import { PostStatus, SocialPlatform } from "@prisma/client";
import { dateOrNull, optionalUrl } from "./common";

export const socialPlatformSchema = z.nativeEnum(SocialPlatform);
export const postStatusSchema = z.nativeEnum(PostStatus);

export const postCreateSchema = z
  .object({
    body: z.string().trim().min(1, "Il contenuto è obbligatorio").max(10000),
    campaignId: z.string().optional().nullable(),
    mediaUrls: z.array(z.string().url()).max(10).default([]),
    linkUrl: optionalUrl,
    status: postStatusSchema.default("DRAFT"),
    scheduledAt: dateOrNull,
    timezone: z.string().default("Europe/Rome"),
    socialAccountIds: z.array(z.string()).default([]),
    metadata: z.record(z.unknown()).default({})
  })
  .superRefine((value, ctx) => {
    if (value.status === "SCHEDULED" && !value.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "Imposta una data per il post programmato"
      });
    }
    if (value.status === "SCHEDULED" && value.socialAccountIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["socialAccountIds"],
        message: "Seleziona almeno un canale social"
      });
    }
  });

export const postUpdateSchema = z.object({
  body: z.string().trim().min(1).max(10000).optional(),
  campaignId: z.string().nullable().optional(),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  linkUrl: optionalUrl,
  status: postStatusSchema.optional(),
  scheduledAt: dateOrNull,
  timezone: z.string().optional(),
  socialAccountIds: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const schedulePostSchema = z.object({
  scheduledAt: z.union([z.string().datetime({ offset: true }), z.string().date()]),
  socialAccountIds: z.array(z.string()).min(1, "Seleziona almeno un canale")
});

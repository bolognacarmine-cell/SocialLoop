import { z } from "zod";
import { SocialPlatform } from "@prisma/client";

export const socialPlatformSchema = z.nativeEnum(SocialPlatform);

export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  error: z.string().optional(),
  error_description: z.string().optional()
});

export const webhookParamsSchema = z.object({
  platform: socialPlatformSchema
});

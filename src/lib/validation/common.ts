import { z } from "zod";

export const cuidSchema = z.string().min(1, "ID obbligatorio");
export const emailSchema = z.string().trim().toLowerCase().email("Email non valida");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.string().optional(),
  stage: z.string().optional(),
  campaignId: z.string().optional()
});

export const dateOrNull = z
  .union([z.string().datetime({ offset: true }), z.string().date(), z.null()])
  .optional()
  .transform((value) => (value ? new Date(value) : null));

export const optionalUrl = z
  .string()
  .trim()
  .url("URL non valido")
  .or(z.literal(""))
  .optional()
  .transform((value) => value || null);

export const jsonObject = z.record(z.unknown());

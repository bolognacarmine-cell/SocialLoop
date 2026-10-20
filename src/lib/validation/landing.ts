import { z } from "zod";
import { optionalUrl } from "./common";

export const BLOCK_TYPES = [
  "hero",
  "text",
  "image",
  "features",
  "testimonial",
  "form",
  "cta",
  "faq"
] as const;

export const landingBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(BLOCK_TYPES),
  title: z.string().max(200).optional(),
  text: z.string().max(5000).optional(),
  imageUrl: optionalUrl,
  ctaLabel: z.string().max(60).optional(),
  ctaUrl: optionalUrl,
  align: z.enum(["left", "center"]).optional(),
  items: z.array(z.string().max(300)).max(12).optional()
});

export const formFieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Nome campo non valido"),
  label: z.string().min(1).max(120),
  type: z.enum(["text", "email", "tel", "textarea", "select", "checkbox"]),
  required: z.boolean().default(false),
  placeholder: z.string().max(160).optional(),
  options: z.array(z.string().max(80)).max(20).optional()
});

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa solo lettere minuscole, numeri e trattini")
  .min(3)
  .max(60);

export const landingPageCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  headline: z.string().trim().max(200).optional(),
  blocks: z.array(landingBlockSchema).default([]),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(400).optional(),
  customDomain: z.string().trim().max(200).optional().nullable(),
  theme: z.record(z.unknown()).default({}),
  published: z.boolean().default(false),
  form: z
    .object({
      name: z.string().min(1).max(120).default("Lead form"),
      fields: z.array(formFieldSchema).min(1).default([
        {
          name: "email",
          label: "Email",
          type: "email",
          required: true
        }
      ]),
      submitLabel: z.string().max(60).default("Ricevi l'offerta"),
      successMessage: z.string().max(500).default("Grazie! Controlla la tua inbox."),
      redirectUrl: optionalUrl
    })
    .optional()
});

export const landingPageUpdateSchema = landingPageCreateSchema.partial().extend({
  form: landingPageCreateSchema.shape.form
});

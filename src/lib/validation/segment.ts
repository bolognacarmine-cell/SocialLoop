import { z } from "zod";
import { conditionGroupSchema } from "./workflow";

export const segmentCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  rules: conditionGroupSchema.default({ match: "all", rules: [] })
});

export const segmentUpdateSchema = segmentCreateSchema.partial();

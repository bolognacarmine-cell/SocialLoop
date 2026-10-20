import { z } from "zod";
import {
  SocialPlatform,
  WorkflowStatus,
  WorkflowTriggerType
} from "@prisma/client";

export const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
  "exists",
  "not_exists",
  "in",
  "not_in"
]);

export const conditionSchema = z.object({
  field: z.string().min(1).max(120),
  operator: conditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]).optional()
});

export const conditionGroupSchema = z.object({
  match: z.enum(["all", "any"]).default("all"),
  rules: z.array(conditionSchema).max(20).default([])
});

export const ACTION_TYPES = [
  "send_email",
  "add_tag",
  "remove_tag",
  "update_score",
  "set_stage",
  "add_to_segment",
  "add_to_retargeting",
  "create_social_post",
  "send_webhook"
] as const;

export const actionSchema = z.object({
  type: z.enum(ACTION_TYPES),
  templateId: z.string().optional(),
  tagName: z.string().max(60).optional(),
  segmentId: z.string().optional(),
  amount: z.coerce.number().int().min(-1000).max(1000).optional(),
  reason: z.string().max(200).optional(),
  stage: z.string().optional(),
  audienceName: z.string().max(120).optional(),
  platform: z.nativeEnum(SocialPlatform).optional(),
  campaignId: z.string().optional(),
  body: z.string().max(5000).optional(),
  scheduledInMinutes: z.coerce.number().int().min(0).max(525600).optional(),
  socialAccountIds: z.array(z.string()).optional(),
  url: z.string().url().optional()
});

export const delaySchema = z.object({
  amount: z.coerce.number().int().min(1).max(525600),
  unit: z.enum(["minutes", "hours", "days"]).default("hours")
});

export const workflowStepSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["condition", "action", "delay"]),
    condition: conditionGroupSchema.optional(),
    action: actionSchema.optional(),
    delay: delaySchema.optional()
  })
  .superRefine((step, ctx) => {
    if (step.type === "condition" && !step.condition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition"],
        message: "La condizione è obbligatoria"
      });
    }
    if (step.type === "action" && !step.action) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["action"],
        message: "L'azione è obbligatoria"
      });
    }
    if (step.type === "delay" && !step.delay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["delay"],
        message: "Il delay è obbligatorio"
      });
    }
  });

export const workflowCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.nativeEnum(WorkflowStatus).default("DRAFT"),
  triggerType: z.nativeEnum(WorkflowTriggerType),
  triggerConfig: conditionGroupSchema
    .extend({
      tag: z.string().optional(),
      stage: z.string().optional(),
      minScore: z.coerce.number().int().optional()
    })
    .default({ match: "all", rules: [] }),
  steps: z.array(workflowStepSchema).min(1).max(40)
});

export const workflowUpdateSchema = workflowCreateSchema.partial();

export const workflowRunSchema = z.object({
  leadId: z.string().optional()
});

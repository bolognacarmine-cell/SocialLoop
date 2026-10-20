import { z } from "zod";
import { emailSchema } from "./common";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password obbligatoria")
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome troppo corto").max(80),
  email: emailSchema,
  password: z
    .string()
    .min(8, "La password deve avere almeno 8 caratteri")
    .max(128, "Password troppo lunga"),
  workspaceName: z.string().trim().min(2, "Nome workspace troppo corto").max(80)
});

export const switchWorkspaceSchema = z.object({
  workspaceId: z.string().min(1)
});

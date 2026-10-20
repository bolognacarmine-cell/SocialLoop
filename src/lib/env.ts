import { z } from "zod";

const DEV_AUTH_SECRET = "dev-only-auth-secret-change-me-0123456789";
const DEV_ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .default("postgresql://socialloop:socialloop@localhost:5432/socialloop?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  AUTH_SECRET: z.string().min(32).default(DEV_AUTH_SECRET),
  TOKEN_ENCRYPTION_KEY: z.string().default(DEV_ENCRYPTION_KEY),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  MOCK_SOCIAL: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SOCIAL_TOKEN_REFRESH_MARGIN_MINUTES: z.coerce.number().int().min(1).default(10),
  SEED_DEMO_EMAIL: z.string().email().default("demo@socialloop.local"),
  SEED_DEMO_PASSWORD: z.string().min(8).default("demo1234"),
  SEED_DEMO_NAME: z.string().default("Demo Founder"),
  SEED_DEMO_WORKSPACE: z.string().default("SocialLoop Demo"),
  META_CLIENT_ID: z.string().default(""),
  META_CLIENT_SECRET: z.string().default(""),
  LINKEDIN_CLIENT_ID: z.string().default(""),
  LINKEDIN_CLIENT_SECRET: z.string().default(""),
  X_CLIENT_ID: z.string().default(""),
  X_CLIENT_SECRET: z.string().default(""),
  TIKTOK_CLIENT_ID: z.string().default(""),
  TIKTOK_CLIENT_SECRET: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  EMAIL_FROM: z.string().default("SocialLoop <hello@socialloop.local>")
});

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";

if (isProduction && (env.AUTH_SECRET === DEV_AUTH_SECRET || env.TOKEN_ENCRYPTION_KEY === DEV_ENCRYPTION_KEY)) {
  // Fail loudly in production, but keep local builds usable.
  throw new Error(
    "AUTH_SECRET and TOKEN_ENCRYPTION_KEY must be configured with real values in production."
  );
}

export const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

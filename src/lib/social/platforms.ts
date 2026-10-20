import type { SocialPlatform } from "@prisma/client";

export const SUPPORTED_PLATFORMS: SocialPlatform[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "X",
  "TIKTOK",
  "YOUTUBE"
];

export const PLATFORM_META: Record<
  SocialPlatform,
  { label: string; color: string; short: string }
> = {
  INSTAGRAM: { label: "Instagram", color: "#e1306c", short: "IG" },
  FACEBOOK: { label: "Facebook", color: "#1877f2", short: "FB" },
  LINKEDIN: { label: "LinkedIn", color: "#0a66c2", short: "LI" },
  X: { label: "X", color: "#0f172a", short: "X" },
  TIKTOK: { label: "TikTok", color: "#111827", short: "TT" },
  YOUTUBE: { label: "YouTube", color: "#ff0000", short: "YT" }
};

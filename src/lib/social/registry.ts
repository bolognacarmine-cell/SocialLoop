import type { SocialPlatform } from "@prisma/client";
import type { SocialAdapter } from "./types";
import { FacebookAdapter } from "./adapters/facebook";
import { InstagramAdapter } from "./adapters/instagram";
import { LinkedInAdapter } from "./adapters/linkedin";
import { TikTokAdapter } from "./adapters/tiktok";
import { XAdapter } from "./adapters/x";
import { YouTubeAdapter } from "./adapters/youtube";

export { PLATFORM_META, SUPPORTED_PLATFORMS } from "./platforms";

const adapters: Record<SocialPlatform, SocialAdapter> = {
  INSTAGRAM: new InstagramAdapter(),
  FACEBOOK: new FacebookAdapter(),
  LINKEDIN: new LinkedInAdapter(),
  X: new XAdapter(),
  TIKTOK: new TikTokAdapter(),
  YOUTUBE: new YouTubeAdapter()
};

export function getSocialAdapter(platform: SocialPlatform): SocialAdapter {
  const adapter = adapters[platform];
  if (!adapter) throw new Error(`Unsupported social platform: ${platform}`);
  return adapter;
}

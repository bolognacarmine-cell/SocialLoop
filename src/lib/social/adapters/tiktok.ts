import type { SocialPlatform } from "@prisma/client";
import { env } from "@/lib/env";
import { BaseSocialAdapter } from "../base";
import type { ProviderConfig, PublishInput, PublishResult } from "../types";

type TikTokUser = {
  data: {
    user: {
      open_id: string;
      display_name: string;
      avatar_url?: string;
    };
  };
};

export class TikTokAdapter extends BaseSocialAdapter {
  readonly platform: SocialPlatform = "TIKTOK";
  readonly label = "TikTok";
  protected readonly mockIdentity = {
    externalId: "mock-tiktok-account",
    accountName: "@socialloop.demo"
  };

  protected readonly config: ProviderConfig = {
    authorizationUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.upload", "video.publish"],
    clientId: env.TIKTOK_CLIENT_ID,
    clientSecret: env.TIKTOK_CLIENT_SECRET,
    authClientIdParam: "client_key",
    tokenClientIdParam: "client_key",
    documentationUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started"
  };

  protected async resolveAccount(accessToken: string) {
    const response = await this.fetchJson<TikTokUser>(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      accessToken
    );
    return {
      externalId: response.data.user.open_id,
      accountName: `@${response.data.user.display_name}`,
      avatarUrl: response.data.user.avatar_url,
      metadata: { openId: response.data.user.open_id }
    };
  }

  protected async publishReal(input: PublishInput): Promise<PublishResult> {
    const videoUrl = input.mediaUrls.find((url) => /\.(mp4|mov|webm)(\?|$)/i.test(url));
    if (!videoUrl) {
      throw new Error("TikTok richiede un video MP4/MOV. Aggiungi un media video al post.");
    }
    // TikTok requires a multi-step direct upload. This foundation validates input
    // and keeps the adapter contract stable; plug the upload flow here.
    throw new Error(
      "TikTok direct video upload non configurato. Vedi adapter e documentazione TikTok Content Posting API."
    );
  }
}

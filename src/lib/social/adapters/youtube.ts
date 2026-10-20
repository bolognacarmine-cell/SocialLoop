import type { SocialPlatform } from "@prisma/client";
import { env } from "@/lib/env";
import { BaseSocialAdapter } from "../base";
import type { ProviderConfig, PublishInput, PublishResult } from "../types";

type YouTubeChannels = {
  items: Array<{
    id: string;
    snippet: { title: string; thumbnails?: { default?: { url?: string } } };
  }>;
};

export class YouTubeAdapter extends BaseSocialAdapter {
  readonly platform: SocialPlatform = "YOUTUBE";
  readonly label = "YouTube";
  protected readonly mockIdentity = {
    externalId: "mock-youtube-channel",
    accountName: "SocialLoop Demo Channel"
  };

  protected readonly config: ProviderConfig = {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly"
    ],
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    extraAuthParams: { access_type: "offline", prompt: "consent" },
    documentationUrl: "https://developers.google.com/youtube/v3/docs/videos/insert"
  };

  protected async resolveAccount(accessToken: string) {
    const channels = await this.fetchJson<YouTubeChannels>(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      accessToken
    );
    const channel = channels.items?.[0];
    if (!channel) {
      throw new Error("YouTube: nessun canale trovato per questo account Google.");
    }
    return {
      externalId: channel.id,
      accountName: channel.snippet.title,
      avatarUrl: channel.snippet.thumbnails?.default?.url,
      metadata: { channelId: channel.id }
    };
  }

  protected async publishReal(input: PublishInput): Promise<PublishResult> {
    const videoUrl = input.mediaUrls.find((url) => /\.(mp4|mov|webm)(\?|$)/i.test(url));
    if (!videoUrl) {
      throw new Error("YouTube richiede un file video. Aggiungi un media video al post.");
    }
    // Resumable upload requires binary access to the media file.
    throw new Error(
      "YouTube resumable upload non configurato. Collega uno storage e implementa l'upload in questo adapter."
    );
  }
}

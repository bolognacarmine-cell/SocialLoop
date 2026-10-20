import type { SocialPlatform } from "@prisma/client";
import { env } from "@/lib/env";
import { BaseSocialAdapter } from "../base";
import type { ProviderConfig, PublishInput, PublishResult } from "../types";

type XUser = { data: { id: string; name: string; username: string; profile_image_url?: string } };

export class XAdapter extends BaseSocialAdapter {
  readonly platform: SocialPlatform = "X";
  readonly label = "X";
  protected readonly mockIdentity = {
    externalId: "mock-x-account",
    accountName: "@socialloop_demo"
  };

  protected readonly config: ProviderConfig = {
    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    clientId: env.X_CLIENT_ID,
    clientSecret: env.X_CLIENT_SECRET,
    extraAuthParams: { code_challenge_method: "S256" },
    documentationUrl: "https://docs.x.com/x-api/posts/create-post"
  };

  protected async resolveAccount(accessToken: string) {
    const response = await this.fetchJson<XUser>(
      "https://api.twitter.com/2/users/me?user.fields=profile_image_url",
      accessToken
    );
    return {
      externalId: response.data.id,
      accountName: `@${response.data.username}`,
      avatarUrl: response.data.profile_image_url,
      metadata: { username: response.data.username }
    };
  }

  protected async publishReal(input: PublishInput): Promise<PublishResult> {
    const text = input.linkUrl ? `${input.text}\n${input.linkUrl}` : input.text;
    if (text.length > 280) {
      throw new Error("X: il testo supera il limite di 280 caratteri.");
    }
    const data = await this.fetchJson<{ data: { id: string; text: string } }>(
      "https://api.twitter.com/2/tweets",
      input.accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      }
    );
    return {
      remotePostId: data.data.id,
      url: `https://x.com/i/web/status/${data.data.id}`,
      raw: data
    };
  }
}

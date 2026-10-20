import type { SocialPlatform } from "@prisma/client";
import { env } from "@/lib/env";
import { BaseSocialAdapter } from "../base";
import type { ProviderConfig, PublishInput, PublishResult } from "../types";

type UserInfo = {
  sub: string;
  name: string;
  picture?: string;
};

export class LinkedInAdapter extends BaseSocialAdapter {
  readonly platform: SocialPlatform = "LINKEDIN";
  readonly label = "LinkedIn";
  protected readonly mockIdentity = {
    externalId: "mock-linkedin-member",
    accountName: "SocialLoop Demo"
  };

  protected readonly config: ProviderConfig = {
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    documentationUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api"
  };

  protected async resolveAccount(accessToken: string) {
    const user = await this.fetchJson<UserInfo>(
      "https://api.linkedin.com/v2/userinfo",
      accessToken
    );
    return {
      externalId: user.sub,
      accountName: user.name,
      avatarUrl: user.picture,
      metadata: { personUrn: `urn:li:person:${user.sub}` }
    };
  }

  protected async publishReal(input: PublishInput): Promise<PublishResult> {
    const author = String(
      input.account.metadata.personUrn ?? `urn:li:person:${input.account.externalId}`
    );
    const commentary = input.linkUrl ? `${input.text}\n\n${input.linkUrl}` : input.text;
    const data = await this.fetchJson<{ id?: string }>("https://api.linkedin.com/rest/posts", input.accessToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "LinkedIn-Version": "202501",
        "X-Restli-Protocol-Version": "2.0.0"
      },
      body: JSON.stringify({
        author,
        commentary,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED" },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
      })
    });
    const remotePostId = data.id ?? `urn:li:share:${Date.now()}`;
    return {
      remotePostId,
      url: `https://www.linkedin.com/feed/update/${remotePostId}`,
      raw: data
    };
  }
}

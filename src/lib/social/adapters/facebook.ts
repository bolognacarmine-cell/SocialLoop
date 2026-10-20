import type { SocialPlatform } from "@prisma/client";
import { env } from "@/lib/env";
import { BaseSocialAdapter } from "../base";
import type { ProviderConfig, PublishInput, PublishResult } from "../types";

type GraphList<T> = { data: T[] };
type Page = {
  id: string;
  name: string;
  access_token: string;
  picture?: { data?: { url?: string } };
};

const GRAPH = "https://graph.facebook.com/v21.0";

export class FacebookAdapter extends BaseSocialAdapter {
  readonly platform: SocialPlatform = "FACEBOOK";
  readonly label = "Facebook";
  protected readonly mockIdentity = {
    externalId: "mock-facebook-page",
    accountName: "SocialLoop Demo Page"
  };

  protected readonly config: ProviderConfig = {
    authorizationUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "public_profile"],
    clientId: env.META_CLIENT_ID,
    clientSecret: env.META_CLIENT_SECRET,
    documentationUrl: "https://developers.facebook.com/docs/pages-api/posts"
  };

  protected async resolveAccount(accessToken: string) {
    const pages = await this.fetchJson<GraphList<Page>>(
      `${GRAPH}/me/accounts?fields=id,name,access_token,picture&access_token=${encodeURIComponent(accessToken)}`,
      accessToken
    );
    const page = pages.data?.[0];
    if (!page) {
      throw new Error("Facebook: nessuna Pagina trovata. Serve un account con una Pagina.");
    }
    return {
      externalId: page.id,
      accountName: page.name,
      avatarUrl: page.picture?.data?.url,
      accessToken: page.access_token,
      metadata: { pageId: page.id }
    };
  }

  protected async publishReal(input: PublishInput): Promise<PublishResult> {
    const pageId = String(input.account.metadata.pageId ?? input.account.externalId);
    const body = new URLSearchParams({
      message: input.text,
      access_token: input.accessToken
    });
    if (input.linkUrl) body.set("link", input.linkUrl);
    const response = await fetch(`${GRAPH}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = (await response.json()) as { id?: string; error?: { message?: string } };
    if (!response.ok || !data.id) {
      throw new Error(`Facebook publish error: ${data.error?.message ?? response.statusText}`);
    }
    return {
      remotePostId: data.id,
      url: `https://www.facebook.com/${data.id}`,
      raw: data
    };
  }
}

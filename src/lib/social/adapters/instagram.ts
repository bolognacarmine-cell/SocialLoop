import type { SocialPlatform } from "@prisma/client";
import { env } from "@/lib/env";
import { BaseSocialAdapter } from "../base";
import type { ProviderConfig, PublishInput, PublishResult } from "../types";

type GraphList<T> = { data: T[] };
type Page = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username: string;
    profile_picture_url?: string;
  };
};

const GRAPH = "https://graph.facebook.com/v21.0";

export class InstagramAdapter extends BaseSocialAdapter {
  readonly platform: SocialPlatform = "INSTAGRAM";
  readonly label = "Instagram";
  protected readonly mockIdentity = {
    externalId: "mock-instagram-account",
    accountName: "@socialloop.demo"
  };

  protected readonly config: ProviderConfig = {
    authorizationUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH}/oauth/access_token`,
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "business_management"
    ],
    clientId: env.META_CLIENT_ID,
    clientSecret: env.META_CLIENT_SECRET,
    documentationUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing"
  };

  protected async resolveAccount(accessToken: string) {
    const pages = await this.fetchJson<GraphList<Page>>(
      `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}`,
      accessToken
    );
    const page = pages.data?.find((item) => item.instagram_business_account);
    const ig = page?.instagram_business_account;
    if (!page || !ig) {
      throw new Error(
        "Instagram: nessun account Business/Creator collegato a una Pagina Facebook."
      );
    }
    return {
      externalId: ig.id,
      accountName: `@${ig.username}`,
      avatarUrl: ig.profile_picture_url,
      accessToken: page.access_token,
      metadata: { pageId: page.id, igUserId: ig.id, username: ig.username }
    };
  }

  protected async publishReal(input: PublishInput): Promise<PublishResult> {
    const igUserId = String(input.account.metadata.igUserId ?? input.account.externalId);
    const imageUrl =
      input.mediaUrls.find((url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url)) ?? input.mediaUrls[0];

    if (!imageUrl) {
      throw new Error(
        "Instagram richiede un'immagine o un video. Aggiungi un media URL al post."
      );
    }

    const caption = input.linkUrl ? `${input.text}\n\n${input.linkUrl}` : input.text;
    const container = await this.fetchJson<{ id: string }>(
      `${GRAPH}/${igUserId}/media`,
      input.accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, caption })
      }
    );

    const published = await this.fetchJson<{ id: string }>(
      `${GRAPH}/${igUserId}/media_publish`,
      input.accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: container.id })
      }
    );

    return {
      remotePostId: published.id,
      url: `https://www.instagram.com/p/${published.id}`,
      raw: published
    };
  }
}

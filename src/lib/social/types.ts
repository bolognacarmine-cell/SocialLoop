import type { SocialPlatform } from "@prisma/client";

export type OAuthStartInput = {
  state: string;
  redirectUri: string;
};

export type OAuthStart = {
  url: string;
  codeVerifier?: string;
};

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scopes: string[];
  externalId: string;
  accountName: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
};

export type PublishInput = {
  text: string;
  mediaUrls: string[];
  linkUrl?: string | null;
  accessToken: string;
  account: {
    id: string;
    externalId: string;
    accountName: string;
    metadata: Record<string, unknown>;
  };
};

export type PublishResult = {
  remotePostId: string;
  url?: string;
  raw?: unknown;
};

export type WebhookVerificationInput = {
  rawBody: string;
  headers: Record<string, string | undefined>;
  payload: unknown;
};

export type SocialWebhookEvent = {
  type: string;
  externalId?: string;
  accountExternalId?: string;
  postExternalId?: string;
  status?: string;
  payload: unknown;
};

export interface SocialAdapter {
  readonly platform: SocialPlatform;
  readonly label: string;
  readonly isMock: boolean;
  getScopes(): string[];
  getAuthorizationUrl(input: OAuthStartInput): OAuthStart;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
  }): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  publish(input: PublishInput): Promise<PublishResult>;
  verifyWebhook(input: WebhookVerificationInput): boolean;
  parseWebhook(payload: unknown, headers: Record<string, string | undefined>): SocialWebhookEvent;
}

export type ProviderConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  authClientIdParam?: string;
  tokenClientIdParam?: string;
  extraAuthParams?: Record<string, string>;
  extraTokenParams?: Record<string, string>;
  apiVersion?: string;
  documentationUrl: string;
};

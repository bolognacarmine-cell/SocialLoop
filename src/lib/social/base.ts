import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { SocialPlatform } from "@prisma/client";
import type {
  OAuthStart,
  OAuthStartInput,
  OAuthTokens,
  ProviderConfig,
  PublishInput,
  PublishResult,
  SocialAdapter,
  SocialWebhookEvent,
  WebhookVerificationInput
} from "./types";

type RawTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export abstract class BaseSocialAdapter implements SocialAdapter {
  abstract readonly platform: SocialPlatform;
  abstract readonly label: string;
  protected abstract readonly config: ProviderConfig;
  protected abstract readonly mockIdentity: {
    externalId: string;
    accountName: string;
    avatarUrl?: string;
  };

  get isMock() {
    return (
      env.MOCK_SOCIAL ||
      !this.config.clientId ||
      !this.config.clientSecret ||
      this.config.clientId.startsWith("change-me")
    );
  }

  getScopes() {
    return this.config.scopes;
  }

  getAuthorizationUrl({ state, redirectUri }: OAuthStartInput): OAuthStart {
    if (this.isMock) {
      const params = new URLSearchParams({ code: `mock-code-${this.platform}`, state });
      return {
        url: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/oauth/${this.platform}/callback?${params.toString()}`
      };
    }

    const params = new URLSearchParams({
      response_type: "code",
      [this.config.authClientIdParam ?? "client_id"]: this.config.clientId,
      redirect_uri: redirectUri,
      scope: this.config.scopes.join(" "),
      state,
      ...(this.config.extraAuthParams ?? {})
    });

    if (this.platform === "X") {
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHashChallenge(verifier);
      params.set("code_challenge", challenge);
      params.set("code_challenge_method", "S256");
      return {
        url: `${this.config.authorizationUrl}?${params.toString()}`,
        codeVerifier: verifier
      };
    }

    return { url: `${this.config.authorizationUrl}?${params.toString()}` };
  }

  async exchangeCode({
    code,
    redirectUri,
    codeVerifier
  }: {
    code: string;
    redirectUri: string;
    codeVerifier?: string | null;
  }): Promise<OAuthTokens> {
    if (this.isMock) {
      return {
        accessToken: `mock-access-${this.platform.toLowerCase()}-${randomBytes(6).toString("hex")}`,
        refreshToken: `mock-refresh-${this.platform.toLowerCase()}-${randomBytes(6).toString("hex")}`,
        expiresIn: 60 * 60,
        scopes: this.config.scopes,
        externalId: this.mockIdentity.externalId,
        accountName: this.mockIdentity.accountName,
        avatarUrl: this.mockIdentity.avatarUrl,
        metadata: { mock: true, platform: this.platform }
      };
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      [this.config.tokenClientIdParam ?? "client_id"]: this.config.clientId,
      client_secret: this.config.clientSecret,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      ...(this.config.extraTokenParams ?? {})
    });

    const raw = await this.requestTokens(body);
    const account = await this.resolveAccount(raw.access_token);
    return {
      accessToken: account.accessToken ?? raw.access_token,
      refreshToken: raw.refresh_token,
      expiresIn: raw.expires_in,
      scopes: raw.scope?.split(/[ ,]+/).filter(Boolean) ?? this.config.scopes,
      ...account
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    if (this.isMock) {
      return {
        accessToken: `mock-access-${this.platform.toLowerCase()}-${randomBytes(6).toString("hex")}`,
        refreshToken,
        expiresIn: 60 * 60,
        scopes: this.config.scopes,
        externalId: this.mockIdentity.externalId,
        accountName: this.mockIdentity.accountName,
        avatarUrl: this.mockIdentity.avatarUrl,
        metadata: { mock: true, platform: this.platform }
      };
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      [this.config.tokenClientIdParam ?? "client_id"]: this.config.clientId,
      client_secret: this.config.clientSecret
    });
    const raw = await this.requestTokens(body);
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token ?? refreshToken,
      expiresIn: raw.expires_in,
      scopes: raw.scope?.split(/[ ,]+/).filter(Boolean) ?? this.config.scopes,
      externalId: this.mockIdentity.externalId,
      accountName: this.mockIdentity.accountName,
      metadata: {}
    };
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    if (this.isMock) {
      const remotePostId = `mock_${this.platform.toLowerCase()}_${Date.now()}_${randomBytes(3).toString("hex")}`;
      return {
        remotePostId,
        url: `https://mock.socialloop.local/${this.platform.toLowerCase()}/${remotePostId}`,
        raw: {
          mock: true,
          publishedAt: new Date().toISOString(),
          text: input.text.slice(0, 280)
        }
      };
    }
    return this.publishReal(input);
  }

  protected async publishReal(_input: PublishInput): Promise<PublishResult> {
    throw new Error(
      `${this.label}: publishing requires a media upload flow that is not configured for this account.`
    );
  }

  verifyWebhook(input: WebhookVerificationInput): boolean {
    if (this.isMock) return true;
    const secret = process.env.SOCIAL_WEBHOOK_SECRET;
    if (!secret) return false;
    const signature =
      input.headers["x-socialloop-signature"] ??
      input.headers["x-hub-signature-256"] ??
      "";
    const expected = createHmac("sha256", secret).update(input.rawBody).digest("hex");
    const normalized = signature.replace(/^sha256=/, "");
    if (normalized.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(normalized), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseWebhook(
    payload: unknown,
    _headers: Record<string, string | undefined>
  ): SocialWebhookEvent {
    const record = (payload ?? {}) as Record<string, unknown>;
    const changes = Array.isArray(record.entry) ? record.entry : [];
    const first = (changes[0] ?? {}) as Record<string, unknown>;
    return {
      type: String(record.event ?? record.object ?? "unknown"),
      externalId: record.id ? String(record.id) : undefined,
      accountExternalId: first.id ? String(first.id) : undefined,
      postExternalId: record.post_id ? String(record.post_id) : undefined,
      status: record.status ? String(record.status) : undefined,
      payload
    };
  }

  protected async requestTokens(body: URLSearchParams): Promise<RawTokens> {
    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = (await response.json().catch(() => ({}))) as RawTokens & {
      error?: string;
      error_description?: string;
    };
    if (!response.ok || data.error || !data.access_token) {
      throw new Error(
        `${this.label} OAuth error: ${data.error_description ?? data.error ?? response.statusText}`
      );
    }
    return data;
  }

  protected async fetchJson<T>(
    url: string,
    accessToken: string,
    init?: RequestInit
  ): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {})
      }
    });
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: { message?: string } | string;
    };
    if (!response.ok) {
      const message =
        typeof data.error === "string" ? data.error : data.error?.message ?? response.statusText;
      throw new Error(`${this.label} API error: ${message}`);
    }
    return data;
  }

  protected abstract resolveAccount(accessToken: string): Promise<{
    externalId: string;
    accountName: string;
    avatarUrl?: string;
    metadata?: Record<string, unknown>;
    accessToken?: string;
  }>;
}

function createHashChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

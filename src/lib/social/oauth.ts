import { randomBytes } from "node:crypto";
import type { SocialPlatform } from "@prisma/client";
import { appUrl, env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { encryptOptionalToken } from "@/lib/crypto/tokens";
import { getSocialAdapter } from "./registry";

export async function createOAuthStart(input: {
  platform: SocialPlatform;
  workspaceId: string;
  userId: string;
}) {
  const adapter = getSocialAdapter(input.platform);
  const state = randomBytes(32).toString("base64url");
  const redirectUri = `${appUrl}/api/oauth/${input.platform}/callback`;
  const start = adapter.getAuthorizationUrl({ state, redirectUri });

  await prisma.oAuthState.create({
    data: {
      state,
      workspaceId: input.workspaceId,
      userId: input.userId,
      platform: input.platform,
      codeVerifier: start.codeVerifier,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  return { url: start.url, state };
}

export async function completeOAuth(input: {
  platform: SocialPlatform;
  code: string;
  state: string;
}) {
  const oauthState = await prisma.oAuthState.findUnique({ where: { state: input.state } });
  if (!oauthState || oauthState.platform !== input.platform) {
    throw new Error("Stato OAuth non valido");
  }
  if (oauthState.expiresAt.getTime() < Date.now()) {
    await prisma.oAuthState.delete({ where: { state: input.state } }).catch(() => undefined);
    throw new Error("Sessione OAuth scaduta, riprova");
  }

  const adapter = getSocialAdapter(input.platform);
  const tokens = await adapter.exchangeCode({
    code: input.code,
    redirectUri: oauthState.redirectUri ?? `${appUrl}/api/oauth/${input.platform}/callback`,
    codeVerifier: oauthState.codeVerifier
  });

  const account = await prisma.socialAccount.upsert({
    where: {
      workspaceId_platform_externalId: {
        workspaceId: oauthState.workspaceId,
        platform: input.platform,
        externalId: tokens.externalId
      }
    },
    create: {
      workspaceId: oauthState.workspaceId,
      platform: input.platform,
      externalId: tokens.externalId,
      accountName: tokens.accountName,
      avatarUrl: tokens.avatarUrl,
      accessToken: encryptOptionalToken(tokens.accessToken)!,
      refreshToken: encryptOptionalToken(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
      scopes: tokens.scopes,
      metadata: (tokens.metadata ?? {}) as object,
      status: "CONNECTED",
      lastSyncedAt: new Date()
    },
    update: {
      accountName: tokens.accountName,
      avatarUrl: tokens.avatarUrl,
      accessToken: encryptOptionalToken(tokens.accessToken)!,
      refreshToken: encryptOptionalToken(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null,
      scopes: tokens.scopes,
      metadata: (tokens.metadata ?? {}) as object,
      status: "CONNECTED",
      lastSyncedAt: new Date()
    }
  });

  await prisma.oAuthState.delete({ where: { state: input.state } }).catch(() => undefined);
  return { account, workspaceId: oauthState.workspaceId, mock: adapter.isMock };
}

export function shouldRefreshToken(expiresAt: Date | null) {
  if (!expiresAt) return false;
  const margin = env.SOCIAL_TOKEN_REFRESH_MARGIN_MINUTES * 60 * 1000;
  return expiresAt.getTime() - Date.now() < margin;
}

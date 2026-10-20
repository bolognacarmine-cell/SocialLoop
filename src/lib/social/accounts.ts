import type { SocialAccount } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptToken, encryptOptionalToken } from "@/lib/crypto/tokens";
import { getSocialAdapter } from "./registry";
import { shouldRefreshToken } from "./oauth";

export async function refreshSocialAccount(account: SocialAccount) {
  if (!account.refreshToken) {
    throw new Error("Questo account non ha un refresh token disponibile.");
  }
  const adapter = getSocialAdapter(account.platform);
  const tokens = await adapter.refreshToken(decryptToken(account.refreshToken));

  return prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encryptOptionalToken(tokens.accessToken)!,
      refreshToken: encryptOptionalToken(tokens.refreshToken ?? decryptToken(account.refreshToken)),
      tokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : account.tokenExpiresAt,
      scopes: tokens.scopes.length ? tokens.scopes : account.scopes,
      status: "CONNECTED",
      lastSyncedAt: new Date()
    }
  });
}

export async function ensureFreshToken(account: SocialAccount) {
  if (shouldRefreshToken(account.tokenExpiresAt) && account.refreshToken) {
    return refreshSocialAccount(account);
  }
  return account;
}

export async function getDecryptedAccessToken(account: SocialAccount) {
  const fresh = await ensureFreshToken(account);
  return decryptToken(fresh.accessToken);
}

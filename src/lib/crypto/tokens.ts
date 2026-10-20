import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = env.TOKEN_ENCRYPTION_KEY.trim();
  let key: Buffer;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      key = Buffer.from(raw, "utf8");
    }
  }

  if (key.length !== 32) {
    key = createHash("sha256").update(raw).digest();
  }

  return key;
}

/**
 * Encrypts an OAuth token with AES-256-GCM.
 * Output format: v1.<iv>.<authTag>.<ciphertext> (base64url).
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error("Cannot encrypt an empty token");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(payload: string): string {
  const [version, ivEncoded, tagEncoded, dataEncoded] = payload.split(".");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !dataEncoded) {
    throw new Error("Invalid encrypted token format");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivEncoded, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataEncoded, "base64url")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

export function encryptOptionalToken(token: string | null | undefined): string | null {
  return token ? encryptToken(token) : null;
}

export function decryptOptionalToken(token: string | null | undefined): string | null {
  return token ? decryptToken(token) : null;
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

import { describe, expect, it } from "vitest";
import {
  decryptToken,
  encryptToken,
  encryptOptionalToken,
  maskToken
} from "@/lib/crypto/tokens";

describe("token encryption", () => {
  it("round-trips a token", () => {
    const secret = "instagram-access-token-123456";
    const encrypted = encryptToken(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(decryptToken(encrypted)).toBe(secret);
  });

  it("produces a different payload each time (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptToken("sensitive");
    const [version, iv, tag, data] = encrypted.split(".");
    const tampered = [version, iv, tag, Buffer.from("hacked").toString("base64url")].join(".");
    expect(() => decryptToken(tampered)).toThrow();
    void data;
  });

  it("handles optional tokens", () => {
    expect(encryptOptionalToken(null)).toBeNull();
    expect(encryptOptionalToken(undefined)).toBeNull();
    expect(decryptToken(encryptOptionalToken("x")!)).toBe("x");
  });

  it("masks tokens for display", () => {
    expect(maskToken("abcdefghijklmnop")).toBe("abcd••••mnop");
    expect(maskToken("short")).toBe("••••");
  });
});

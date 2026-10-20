import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "socialloop_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
};

function secretKey() {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.workspaceId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      email: payload.email,
      name: payload.name
    };
  } catch {
    return null;
  }
}

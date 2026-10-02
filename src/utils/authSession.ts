import crypto from "crypto";
import { cookies } from "next/headers";
import { tokenRepository } from "@/repositories/drizzle/tokenRepository";
import { signAccessToken } from "@/utils/jwt";

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60; // keep in sync with signAccessToken's own 15m TTL
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Mints a new access/refresh token pair, stores the refresh session, and sets both cookies.
 * Shared by every route that starts or rotates a session (Google login, dev-login, refresh)
 * so the mint/hash/cookie logic isn't copy-pasted in each one.
 *
 * Pass `tokenFamily` on rotation to keep the existing family (so reuse detection still spans
 * the whole chain); omit it to start a brand new family (first login).
 */
export async function issueSession(userId: string, email: string, tokenFamily?: string): Promise<void> {
  const jti = crypto.randomUUID();
  const family = tokenFamily ?? crypto.randomUUID();

  const accessToken = await signAccessToken(userId, email);
  const refreshToken = crypto.randomBytes(40).toString("hex");
  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

  await tokenRepository.createSession({
    id: jti,
    userId,
    refreshTokenHash,
    isUsed: false,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000),
    tokenFamily: family,
  });

  const cookieStore = await cookies();
  // Secure in production only; every caller of this helper already refuses to run in a context
  // where that would be wrong (dev-login 403s outside dev, the other two are always server-side).
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set("accessToken", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    path: "/",
  });

  cookieStore.set("refreshToken", `${jti}.${refreshToken}`, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    path: "/api/v1/auth",
  });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { tokenRepository } from "@/repositories/drizzle/tokenRepository";
import { issueSession } from "@/utils/authSession";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { isAllowedAdminEmail, verifyAdminToken, verifyToken } from "@/utils/jwt";
import { userRepository } from "@/repositories/drizzle/userRepository";
import { logger } from "@/modules/logger";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const refreshTokenCookie = cookieStore.get("refreshToken")?.value;
    const accessTokenCookie = cookieStore.get("accessToken")?.value;

    if (!refreshTokenCookie) {
      throw new UnauthorizedError("Refresh token missing");
    }

    const [jti, tokenValue] = refreshTokenCookie.split(".");
    if (!jti || !tokenValue) {
      throw new UnauthorizedError("Malformed refresh token");
    }

    const session = await tokenRepository.getSessionById(jti);
    if (!session) {
      throw new UnauthorizedError("Session not found");
    }

    // Advanced Theft Detection: Heuristic 2 (Premature Refresh)
    // If the access token is still present and valid, and someone is refreshing, it could be a stolen session replay.
    const isSuspicious = async (token: string | undefined): Promise<boolean> => {
      if (!token) return false;
      // Only a token the proxy would still accept counts as "still good". One it would refuse (issued
      // before the email claim existed, or for a removed address) must reach the checks below instead
      // of revoking the family here, so a pre-claim session upgrades through one ordinary refresh.
      if (!(await verifyAdminToken(token))) return false;
      const decoded = await verifyToken(token);
      if (!decoded || !decoded.exp) return false;
      return (decoded.exp * 1000 - Date.now()) > 2 * 60 * 1000; // Suspect if > 2 minutes remaining
    };

    if (await isSuspicious(accessTokenCookie)) {
      logger.warn("[THEFT DETECTION] Premature refresh attempted. Revoking family.", { userId: session.userId });
      await tokenRepository.revokeFamily(session.tokenFamily);
      clearCookies(cookieStore);
      throw new UnauthorizedError("Suspicious token refresh activity detected. Session revoked.");
    }

    // Verify token hash
    const hash = crypto.createHash("sha256").update(tokenValue).digest("hex");
    if (hash !== session.refreshTokenHash) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      session.isUsed = true;
      await tokenRepository.updateSession(session);
      clearCookies(cookieStore);
      throw new UnauthorizedError("Refresh token expired");
    }

    // Advanced Theft Detection: Heuristic 1 (Token Reuse)
    if (session.isUsed) {
      logger.warn("[THEFT DETECTION] Reused refresh token detected. Revoking family.", { userId: session.userId });
      await tokenRepository.revokeFamily(session.tokenFamily);
      clearCookies(cookieStore);
      throw new UnauthorizedError("Stolen refresh token detected. All sessions revoked.");
    }

    // Re-check the allowlist on every rotation: otherwise a removed address keeps a working refresh
    // chain for up to 7 days (its access tokens are already refused by the proxy).
    const user = await userRepository.getById(session.userId);
    if (!user || !isAllowedAdminEmail(user.email)) {
      await tokenRepository.revokeFamily(session.tokenFamily);
      clearCookies(cookieStore);
      throw new UnauthorizedError("This account is no longer allowed to sign in.");
    }

    // Token is valid and unused. Proceed with rotation.
    session.isUsed = true;
    await tokenRepository.updateSession(session);

    // Maintain the existing token family so reuse detection still spans the whole chain.
    await issueSession(session.userId, user.email, session.tokenFamily);

    // Opportunistic cleanup: only rows already past expiresAt, so reuse detection
    // on a still-live rotated-out token is unaffected (see tokenRepository.deleteExpired).
    await tokenRepository.deleteExpired();

    return sendSuccess({ success: true });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return sendError(error);
    }
    return sendError(new UnauthorizedError("Failed to refresh token"));
  }
}

function clearCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.delete("accessToken");
  cookieStore.delete({
    name: "refreshToken",
    path: "/api/v1/auth"
  });
}

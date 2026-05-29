import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { tokenRepository } from "@/repositories/json-server/tokenRepository";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { signToken, verifyToken } from "@/lib/jwt";

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
      const decoded = await verifyToken(token);
      if (!decoded || !decoded.exp) return false;
      return (decoded.exp * 1000 - Date.now()) > 2 * 60 * 1000; // Suspect if > 2 minutes remaining
    };

    if (await isSuspicious(accessTokenCookie)) {
      console.warn(`[THEFT DETECTION] Premature refresh attempted for user ${session.userId}. Revoking family.`);
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
    if (Date.now() > session.expiresAt) {
      session.isUsed = true;
      await tokenRepository.updateSession(session);
      clearCookies(cookieStore);
      throw new UnauthorizedError("Refresh token expired");
    }

    // Advanced Theft Detection: Heuristic 1 (Token Reuse)
    if (session.isUsed) {
      console.warn(`[THEFT DETECTION] Reused refresh token detected for user ${session.userId}. Revoking family.`);
      await tokenRepository.revokeFamily(session.tokenFamily);
      clearCookies(cookieStore);
      throw new UnauthorizedError("Stolen refresh token detected. All sessions revoked.");
    }

    // Token is valid and unused. Proceed with rotation.
    session.isUsed = true;
    await tokenRepository.updateSession(session);

    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    
    // Generate new pair
    const newJti = crypto.randomUUID();
    const newAccessToken = await signToken({ userId: session.userId, email, role: "admin" }, "15m");
    const newRefreshToken = crypto.randomBytes(40).toString("hex");
    const newRefreshTokenHash = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

    await tokenRepository.createSession({
      id: newJti,
      userId: session.userId,
      refreshTokenHash: newRefreshTokenHash,
      isUsed: false,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      tokenFamily: session.tokenFamily, // Maintain family for chain tracking
    });

    // Set new cookies
    cookieStore.set("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60,
      path: "/",
    });

    cookieStore.set("refreshToken", `${newJti}.${newRefreshToken}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/api/v1/auth",
    });

    return sendSuccess({ success: true });
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      return sendError(error);
    }
    return sendError(new UnauthorizedError("Failed to refresh token"));
  }
}

function clearCookies(cookieStore: any) {
  cookieStore.delete("accessToken");
  cookieStore.delete({
    name: "refreshToken",
    path: "/api/v1/auth"
  });
}

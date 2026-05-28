import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { signToken } from "@/lib/jwt";
import { tokenRepository } from "@/repositories/tokenRepository";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { code, redirectUri } = await request.json();

    if (!code || !redirectUri) {
      throw new UnauthorizedError("Code and redirectUri are required");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!clientId || !clientSecret || !adminEmail) {
      throw new Error("Server OAuth configuration is missing");
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.id_token) {
      throw new UnauthorizedError("Failed to exchange code for Google tokens");
    }

    // Decode ID token to get email
    const decodedIdToken = decodeJwt(tokenData.id_token);
    const email = decodedIdToken.email as string;

    if (!email || email.toLowerCase() !== adminEmail.toLowerCase()) {
      throw new UnauthorizedError("Unauthorized email address");
    }

    // Generate our own Access and Refresh Tokens
    const jti = crypto.randomUUID();
    const tokenFamily = crypto.randomUUID();
    const userId = "admin"; // In a full system, you might fetch user ID by email

    const accessToken = await signToken({ userId, email, role: "admin" }, "15m");
    const refreshToken = crypto.randomBytes(40).toString("hex");

    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Store the refresh token session
    await tokenRepository.createSession({
      id: jti,
      userId,
      refreshTokenHash,
      isUsed: false,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      tokenFamily,
    });

    // Set Cookies
    const cookieStore = await cookies();
    cookieStore.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60, // 15 mins
      path: "/",
    });

    cookieStore.set("refreshToken", `${jti}.${refreshToken}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/api/v1/auth", // Only send refresh token to auth routes
    });

    return sendSuccess({ success: true, email });
  } catch (error: any) {
    console.error("Google Exchange Error:", error);
    if (error instanceof UnauthorizedError) {
      return sendError(error);
    }
    return sendError(new UnauthorizedError("Authentication failed"));
  }
}

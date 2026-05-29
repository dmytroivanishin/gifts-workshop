import { NextResponse } from "next/server";
import { signToken } from "@/lib/jwt";
import { tokenRepository } from "@/repositories/json-server/tokenRepository";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Only allow dev login in non-production environments
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
    }

    const jti = crypto.randomUUID();
    const tokenFamily = crypto.randomUUID();
    const userId = "admin";
    const email = process.env.ADMIN_EMAIL || "dev-admin@example.com";

    const accessToken = await signToken({ userId, email, role: "admin" }, "15m");
    const refreshToken = crypto.randomBytes(40).toString("hex");
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Store the refresh token session
    await tokenRepository.createSession({
      id: jti,
      userId,
      refreshTokenHash,
      isUsed: false,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      tokenFamily,
    });

    // Set Cookies
    const cookieStore = await cookies();
    cookieStore.set("accessToken", accessToken, {
      httpOnly: true,
      secure: false, // Local dev is HTTP
      sameSite: "strict",
      maxAge: 15 * 60,
      path: "/",
    });

    cookieStore.set("refreshToken", `${jti}.${refreshToken}`, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/api/v1/auth",
    });

    return sendSuccess({ success: true, email });
  } catch (error: any) {
    return sendError(error);
  }
}

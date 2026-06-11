import { NextResponse } from "next/server";
import { signToken } from "@/utils/jwt";
import { tokenRepository } from "@/repositories/drizzle/tokenRepository";
import { userRepository } from "@/repositories/drizzle/userRepository";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import crypto from "crypto";
import { cookies } from "next/headers";
import { env } from "@/modules/core/env";

export async function POST() {
  try {
    // Only allow dev login in non-production environments
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
    }

    const jti = crypto.randomUUID();
    const tokenFamily = crypto.randomUUID();
    const email = env.ADMIN_EMAILS[0];
    if (!email) {
      throw new Error("ADMIN_EMAILS is not defined or empty");
    }

    // Find or automatically create the admin user to obtain a valid UUID
    let user = await userRepository.getByEmail(email);
    if (!user) {
      user = await userRepository.save({
        id: crypto.randomUUID(),
        email,
        name: "Admin",
        password: "admin_hashed_password",
      });
    }
    const userId = user.id;

    const accessToken = await signToken({ userId, role: "admin" }, "15m");
    const refreshToken = crypto.randomBytes(40).toString("hex");
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    // Store the refresh token session
    await tokenRepository.createSession({
      id: jti,
      userId,
      refreshTokenHash,
      isUsed: false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

    return sendSuccess({ success: true, email, id: userId });
  } catch (error: any) {
    return sendError(error);
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tokenRepository } from "@/repositories/drizzle/tokenRepository";
import { sendSuccess, sendError } from "@/utils/apiResponse";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const refreshTokenCookie = cookieStore.get("refreshToken")?.value;

    if (refreshTokenCookie) {
      const [jti] = refreshTokenCookie.split(".");
      if (jti) {
        const session = await tokenRepository.getSessionById(jti);
        if (session) {
          session.isUsed = true;
          await tokenRepository.updateSession(session);
        }
      }
    }

    // Clear cookies
    cookieStore.delete("accessToken");
    cookieStore.delete({
      name: "refreshToken",
      path: "/api/v1/auth"
    });

    return sendSuccess({ success: true, message: "Logged out successfully" });
  } catch (error: any) {
    return sendError(error);
  }
}

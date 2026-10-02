import { isAllowedAdminEmail } from "@/utils/jwt";
import { tokenRepository } from "@/repositories/drizzle/tokenRepository";
import { userRepository } from "@/repositories/drizzle/userRepository";
import { issueSession } from "@/utils/authSession";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { googleExchangeSchema } from "@/common/validation/schemas";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_PATH,
  decodeOAuthCookie,
  googleRedirectUri,
  statesMatch,
  verifyGoogleIdToken,
} from "@/utils/googleOAuth";
import crypto from "crypto";
import { cookies } from "next/headers";
import { env } from "@/modules/core/env";
import { logger } from "@/modules/logger";

export async function POST(request: Request) {
  try {
    const parsed = googleExchangeSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new UnauthorizedError("Code and state are required");
    }
    const { code, state } = parsed.data;

    const cookieStore = await cookies();
    const saved = decodeOAuthCookie(cookieStore.get(OAUTH_STATE_COOKIE)?.value);
    // Single use: removed whatever the outcome of this attempt
    cookieStore.delete({ name: OAUTH_STATE_COOKIE, path: OAUTH_STATE_COOKIE_PATH });
    if (!saved || !statesMatch(saved.state, state)) {
      throw new UnauthorizedError("Login session is invalid or has expired. Start the login again.");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || env.ADMIN_EMAILS.length === 0) {
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
        redirect_uri: googleRedirectUri(),
        code_verifier: saved.verifier,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.id_token) {
      throw new UnauthorizedError("Failed to exchange code for Google tokens");
    }

    const { email } = await verifyGoogleIdToken(tokenData.id_token, clientId);

    if (!isAllowedAdminEmail(email)) {
      throw new UnauthorizedError("Unauthorized email address");
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

    await issueSession(userId, user.email);

    // Opportunistic cleanup of long-expired sessions (see tokenRepository.deleteExpired).
    await tokenRepository.deleteExpired();

    return sendSuccess({ success: true, email });
  } catch (error: unknown) {
    logger.error("Google login failed", {
      code: "GOOGLE_LOGIN_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof UnauthorizedError) {
      return sendError(error);
    }
    return sendError(new UnauthorizedError("Authentication failed"));
  }
}

import { cookies } from "next/headers";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { env } from "@/modules/core/env";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_PATH,
  OAUTH_STATE_MAX_AGE_SECONDS,
  createGoogleAuthRequest,
  encodeOAuthCookie,
  googleRedirectUri,
} from "@/utils/googleOAuth";

export async function POST() {
  try {
    const { url, state, verifier } = createGoogleAuthRequest(env.GOOGLE_CLIENT_ID, googleRedirectUri());

    const cookieStore = await cookies();
    // Lax, not Strict: the browser comes back from accounts.google.com through a cross-site redirect
    cookieStore.set(OAUTH_STATE_COOKIE, encodeOAuthCookie(state, verifier), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
      path: OAUTH_STATE_COOKIE_PATH,
    });

    return sendSuccess({ url });
  } catch (error: unknown) {
    return sendError(error);
  }
}

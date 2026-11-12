import { cookies } from "next/headers";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { NotFoundError } from "@/common/errors/notFound";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_PATH,
  OAUTH_STATE_MAX_AGE_SECONDS,
  createOAuthAttempt,
  encodeOAuthCookie,
  oauthRedirectUri,
} from "@/utils/oauth/flow";
import { getOAuthStrategy, oauthProviderSchema } from "@/utils/oauth/registry";

export async function POST(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const parsed = oauthProviderSchema.safeParse((await params).provider);
    if (!parsed.success) {
      throw new NotFoundError("Unknown sign-in provider");
    }
    const strategy = getOAuthStrategy(parsed.data);
    if (!strategy.isEnabled()) {
      throw new NotFoundError("Sign-in provider is not configured");
    }

    const attempt = createOAuthAttempt(strategy.id);
    const url = strategy.buildAuthorizeUrl({
      state: attempt.state,
      verifier: attempt.verifier,
      redirectUri: oauthRedirectUri(),
    });

    const cookieStore = await cookies();
    // Lax, not Strict: the browser comes back from the provider through a cross-site redirect
    cookieStore.set(OAUTH_STATE_COOKIE, encodeOAuthCookie(attempt), {
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

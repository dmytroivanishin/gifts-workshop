import { cookies } from "next/headers";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { oauthExchangeSchema } from "@/common/validation/schemas";
import { logger } from "@/modules/logger";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_PATH,
  decodeOAuthCookie,
  oauthRedirectUri,
  statesMatch,
} from "@/utils/oauth/flow";
import { getOAuthStrategy } from "@/utils/oauth/registry";
import { completeAdminLogin } from "@/utils/oauth/completeLogin";

// The provider is not sent by the browser: the start route recorded it in the single-use cookie
export async function POST(request: Request) {
  try {
    const parsed = oauthExchangeSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new UnauthorizedError("Code and state are required");
    }
    const { code, state } = parsed.data;

    const cookieStore = await cookies();
    const attempt = decodeOAuthCookie(cookieStore.get(OAUTH_STATE_COOKIE)?.value);
    // Single use: removed whatever the outcome of this attempt
    cookieStore.delete({ name: OAUTH_STATE_COOKIE, path: OAUTH_STATE_COOKIE_PATH });
    if (!attempt || !statesMatch(attempt.state, state)) {
      throw new UnauthorizedError("Login session is invalid or has expired. Start the login again.");
    }

    const strategy = getOAuthStrategy(attempt.provider);
    if (!strategy.isEnabled()) {
      throw new UnauthorizedError("Sign-in provider is not configured");
    }

    const email = await strategy.exchangeForEmail({
      code,
      verifier: attempt.verifier,
      redirectUri: oauthRedirectUri(),
    });
    await completeAdminLogin(email);

    return sendSuccess({ success: true, email, provider: attempt.provider });
  } catch (error: unknown) {
    logger.error("OAuth login failed", {
      code: "OAUTH_LOGIN_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof UnauthorizedError) {
      return sendError(error);
    }
    return sendError(new UnauthorizedError("Authentication failed"));
  }
}

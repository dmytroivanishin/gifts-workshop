import { z } from "zod";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { env } from "@/modules/core/env";
import type { OAuthStrategy } from "@/utils/oauth/types";

const AUTHORIZE_URL = "https://oauth.yandex.ru/authorize";
const TOKEN_URL = "https://oauth.yandex.ru/token";
const USER_INFO_URL = "https://login.yandex.ru/info?format=json";

const tokenResponseSchema = z.object({ access_token: z.string().min(1) });
// default_email is the account's own mailbox; it is checked against ADMIN_EMAILS by the caller
const userInfoSchema = z.object({ default_email: z.email() });

// Yandex's code flow here is confidential (client secret on the server), so no PKCE is sent: the verifier is unused
export const yandexStrategy: OAuthStrategy = {
  id: "yandex",

  isEnabled: () => Boolean(env.YANDEX_CLIENT_ID && env.YANDEX_CLIENT_SECRET),

  buildAuthorizeUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.YANDEX_CLIENT_ID,
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeForEmail({ code }) {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: env.YANDEX_CLIENT_ID,
        client_secret: env.YANDEX_CLIENT_SECRET,
      }),
    });
    const token = tokenResponseSchema.safeParse(await tokenResponse.json());
    if (!tokenResponse.ok || !token.success) {
      throw new UnauthorizedError("Failed to exchange code for Yandex tokens");
    }

    const userResponse = await fetch(USER_INFO_URL, {
      headers: { Authorization: `OAuth ${token.data.access_token}` },
    });
    const user = userInfoSchema.safeParse(await userResponse.json());
    if (!userResponse.ok || !user.success) {
      throw new UnauthorizedError("Yandex account has no usable email");
    }
    return user.data.default_email;
  },
};

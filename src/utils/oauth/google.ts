import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { env } from "@/modules/core/env";
import type { OAuthStrategy } from "@/utils/oauth/types";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const tokenResponseSchema = z.object({ id_token: z.string().min(1) });

// Checks signature, issuer, audience (our client id) and expiry against Google's published keys, then requires a verified email
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  keys: JWTVerifyGetKey = KEYS
): Promise<{ email: string }> {
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: ISSUERS,
    audience: clientId,
    algorithms: ["RS256"],
  });
  if (typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new UnauthorizedError("Google account email is not verified");
  }
  return { email: payload.email };
}

export const googleStrategy: OAuthStrategy = {
  id: "google",

  isEnabled: () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),

  buildAuthorizeUrl({ state, verifier, redirectUri }) {
    // PKCE: the challenge goes out now, the verifier comes back with the code
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  },

  async exchangeForEmail({ code, verifier, redirectUri }) {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code_verifier: verifier,
        grant_type: "authorization_code",
      }),
    });
    const parsed = tokenResponseSchema.safeParse(await response.json());
    if (!response.ok || !parsed.success) {
      throw new UnauthorizedError("Failed to exchange code for Google tokens");
    }
    const { email } = await verifyGoogleIdToken(parsed.data.id_token, env.GOOGLE_CLIENT_ID);
    return email;
  },
};

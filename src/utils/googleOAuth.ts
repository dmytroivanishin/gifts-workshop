import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { env } from "@/modules/core/env";

export const OAUTH_STATE_COOKIE = "oauthState";
export const OAUTH_STATE_COOKIE_PATH = "/api/v1/auth";
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleAuthRequest {
  url: string;
  state: string;
  verifier: string;
}

// Must equal an "Authorized redirect URI" of the OAuth client in the Google console, in the authorize and the token request alike
export function googleRedirectUri(): string {
  return new URL("/admin/login", env.NEXT_PUBLIC_APP_URL).href;
}

// `state` ties the returning browser to the one that started the login; the PKCE verifier ties the code to it as well
export function createGoogleAuthRequest(clientId: string, redirectUri: string): GoogleAuthRequest {
  const state = crypto.randomBytes(32).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}`, state, verifier };
}

// base64url never contains a dot, so a dot is a safe separator
export function encodeOAuthCookie(state: string, verifier: string): string {
  return `${state}.${verifier}`;
}

export function decodeOAuthCookie(value: string | undefined): { state: string; verifier: string } | undefined {
  const parts = (value ?? "").split(".");
  return parts.length === 2 && parts[0] && parts[1] ? { state: parts[0], verifier: parts[1] } : undefined;
}

export function statesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Checks signature, issuer, audience (our client id) and expiry against Google's published keys, then requires a verified email
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  keys: JWTVerifyGetKey = googleKeys
): Promise<{ email: string }> {
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
    algorithms: ["RS256"],
  });
  if (typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new UnauthorizedError("Google account email is not verified");
  }
  return { email: payload.email };
}

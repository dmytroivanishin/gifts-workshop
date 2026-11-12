import crypto from "crypto";
import { env } from "@/modules/core/env";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "@/utils/oauth/types";

export const OAUTH_STATE_COOKIE = "oauthState";
export const OAUTH_STATE_COOKIE_PATH = "/api/v1/auth";
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

export interface OAuthAttempt {
  provider: OAuthProviderId;
  state: string;
  verifier: string;
}

// Must equal a redirect URI registered in each provider's console. Both providers return to the same page.
export function oauthRedirectUri(): string {
  return new URL("/admin/login", env.NEXT_PUBLIC_APP_URL).href;
}

export function createOAuthAttempt(provider: OAuthProviderId): OAuthAttempt {
  return {
    provider,
    state: crypto.randomBytes(32).toString("base64url"),
    verifier: crypto.randomBytes(32).toString("base64url"),
  };
}

// base64url never contains a dot, so dots are safe separators
export function encodeOAuthCookie(attempt: OAuthAttempt): string {
  return [attempt.provider, attempt.state, attempt.verifier].join(".");
}

export function decodeOAuthCookie(value: string | undefined): OAuthAttempt | undefined {
  const [provider, state, verifier, extra] = (value ?? "").split(".");
  const isKnownProvider = (OAUTH_PROVIDERS as readonly string[]).includes(provider ?? "");
  if (!isKnownProvider || !state || !verifier || extra !== undefined) return undefined;
  return { provider: provider as OAuthProviderId, state, verifier };
}

export function statesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

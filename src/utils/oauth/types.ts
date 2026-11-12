export const OAUTH_PROVIDERS = ["google", "yandex"] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

// One provider's side of the authorization code flow. Everything shared (state, cookie, redirect
// address, admin allowlist, session) lives outside it, so a strategy only knows its own endpoints.
export interface OAuthStrategy {
  readonly id: OAuthProviderId;
  isEnabled(): boolean;
  buildAuthorizeUrl(input: { state: string; verifier: string; redirectUri: string }): string;
  // Returns the account's email once the provider has confirmed the code and the identity behind it.
  exchangeForEmail(input: { code: string; verifier: string; redirectUri: string }): Promise<string>;
}

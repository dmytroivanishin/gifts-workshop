import { z } from "zod";
import { OAUTH_PROVIDERS, type OAuthProviderId, type OAuthStrategy } from "@/utils/oauth/types";
import { googleStrategy } from "@/utils/oauth/google";
import { yandexStrategy } from "@/utils/oauth/yandex";

const STRATEGIES: Record<OAuthProviderId, OAuthStrategy> = {
  google: googleStrategy,
  yandex: yandexStrategy,
};

export const oauthProviderSchema = z.enum(OAUTH_PROVIDERS);

export function getOAuthStrategy(provider: OAuthProviderId): OAuthStrategy {
  return STRATEGIES[provider];
}

// A provider is offered only when its own settings are present and not empty
export function enabledOAuthProviders(): OAuthProviderId[] {
  return OAUTH_PROVIDERS.filter((provider) => STRATEGIES[provider].isEnabled());
}

import { env } from "@/modules/core/env";

export const APP_URL = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Matches proxy.ts's own fallback for a visitor with no saved locale and no matching Accept-Language.
const DEFAULT_PUBLIC_LOCALE = process.env.NEXT_PUBLIC_DEFAULT_LOCALE_PUBLIC || "en";

// hreflang map for one page: every supported locale -> that page's address in the locale, plus an
// optional `x-default`. `path` is what follows the locale, with a leading slash ("" is the homepage).
export function languageAlternates(path = "", options: { withDefault?: boolean } = {}): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const locale of env.SUPPORTED_LOCALES) alternates[locale] = `${APP_URL}/${locale}${path}`;
  if (options.withDefault) alternates["x-default"] = `${APP_URL}/${DEFAULT_PUBLIC_LOCALE}${path}`;
  return alternates;
}

import { logger } from "@/modules/logger";

const requiredEnvVars = [
  "DB_URI",
  "S3_PUBLIC_URL",
  "S3_BUCKET_NAME",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ADMIN_EMAILS",
  "JWT_SECRET",
  "NEXT_PUBLIC_MAX_FILE_SIZE_MB",
  "NEXT_PUBLIC_SUPPORTED_LOCALES",
  "NEXT_PUBLIC_DEFAULT_LOCALE",
  "NEXT_PUBLIC_APP_URL",
  "SITE_TITLE_RU",
  "SITE_TITLE_EN",
  "SITE_TEMPLATE_RU",
  "SITE_TEMPLATE_EN",
  "SITE_DESCRIPTION_RU",
  "SITE_DESCRIPTION_EN",
  "SITE_KEYWORDS_RU",
  "SITE_KEYWORDS_EN",
  "SITE_NAME_RU",
  "SITE_NAME_EN",
  "NEXT_PUBLIC_DEV_MODE",
  "NEXT_PUBLIC_SOCIAL_LINKS"
];

// Called once when the server starts (src/instrumentation.ts), not on import: `next build` loads
// this module too, and the real values only exist at runtime, so the build must not check them.
export function assertRequiredEnv(): void {
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missingVars.length > 0) {
    const errorMsg = `CRITICAL: Missing required environment variables: ${missingVars.join(", ")}`;
    logger.error(errorMsg, { code: "ENV_MISSING" });
    throw new Error(errorMsg);
  }
}

export const env = {
  DB_URI: process.env.DB_URI!,
  // Public base URL the media folder is served under (Caddy in dev, test and production)
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL!,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  // Optional: the Yandex sign-in icon is shown only when both are set and not empty.
  YANDEX_CLIENT_ID: process.env.YANDEX_CLIENT_ID ?? "",
  YANDEX_CLIENT_SECRET: process.env.YANDEX_CLIENT_SECRET ?? "",
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS ?? "").split(",").map(entry => entry.trim()),
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB!,
  SUPPORTED_LOCALES: (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES ?? "").split(",").map(entry => entry.trim()),
  DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE!,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
  SITE_TITLE_RU: process.env.SITE_TITLE_RU!,
  SITE_TITLE_EN: process.env.SITE_TITLE_EN!,
  SITE_TEMPLATE_RU: process.env.SITE_TEMPLATE_RU!,
  SITE_TEMPLATE_EN: process.env.SITE_TEMPLATE_EN!,
  SITE_DESCRIPTION_RU: process.env.SITE_DESCRIPTION_RU!,
  SITE_DESCRIPTION_EN: process.env.SITE_DESCRIPTION_EN!,
  SITE_KEYWORDS_RU: process.env.SITE_KEYWORDS_RU!,
  SITE_KEYWORDS_EN: process.env.SITE_KEYWORDS_EN!,
  SITE_NAME_RU: process.env.SITE_NAME_RU!,
  SITE_NAME_EN: process.env.SITE_NAME_EN!,
  NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE === "true",
  NEXT_PUBLIC_SOCIAL_LINKS: JSON.parse(process.env.NEXT_PUBLIC_SOCIAL_LINKS || '[]') as Array<{name: string, link: string, icon: string}>
};

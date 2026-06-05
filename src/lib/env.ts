import { logger } from "@/modules/logger";

const requiredEnvVars = [
  "DB_URI",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET_NAME",
  "S3_FORCE_PATH_STYLE",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "ADMIN_EMAIL",
  "NEXT_PUBLIC_MAX_FILE_SIZE_MB",
  "NEXT_PUBLIC_DEFAULT_ADMIN_LOCALE",
  "NEXT_PUBLIC_DEFAULT_APP_LOCALE",
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
  "SITE_FOOTER_RU",
  "SITE_FOOTER_EN",
  "SITE_PROJECT_NOT_FOUND_RU",
  "SITE_PROJECT_NOT_FOUND_EN",
  "SITE_PROJECT_DEFAULT_RU",
  "SITE_PROJECT_DEFAULT_EN",
  "NEXT_PUBLIC_DEV_MODE"
];

const missingVars: string[] = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
}

if (missingVars.length > 0) {
  const errorMsg = `CRITICAL: Missing required environment variables: ${missingVars.join(", ")}`;
  logger.error(errorMsg, { code: "ENV_MISSING" });
  throw new Error(errorMsg);
}

export const env = {
  DB_URI: process.env.DB_URI!,
  S3_ENDPOINT: process.env.S3_ENDPOINT!,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY!,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY!,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME!,
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || "10",
  NEXT_PUBLIC_DEFAULT_ADMIN_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_ADMIN_LOCALE || "ru",
  NEXT_PUBLIC_DEFAULT_APP_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_APP_LOCALE || "ru",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};

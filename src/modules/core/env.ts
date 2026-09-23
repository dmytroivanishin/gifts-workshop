import { logger } from "@/modules/logger";

const requiredEnvVars = [
  "DB_URI",
  "S3_ENDPOINT",
  "S3_PUBLIC_URL",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET_NAME",
  "S3_FORCE_PATH_STYLE",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
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
  "SITE_FOOTER_RU",
  "SITE_FOOTER_EN",
  "SITE_PROJECT_NOT_FOUND_RU",
  "SITE_PROJECT_NOT_FOUND_EN",
  "SITE_PROJECT_DEFAULT_RU",
  "SITE_PROJECT_DEFAULT_EN",
  "NEXT_PUBLIC_DEV_MODE",
  "NEXT_PUBLIC_SOCIAL_LINKS"
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
  // Where browsers load images from; S3_ENDPOINT is only what the server connects to
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL!,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY!,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY!,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL!,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS!.split(",").map(e => e.trim()),
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB!,
  SUPPORTED_LOCALES: process.env.NEXT_PUBLIC_SUPPORTED_LOCALES!.split(",").map(l => l.trim()),
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
  SITE_FOOTER_RU: process.env.SITE_FOOTER_RU!,
  SITE_FOOTER_EN: process.env.SITE_FOOTER_EN!,
  SITE_PROJECT_NOT_FOUND_RU: process.env.SITE_PROJECT_NOT_FOUND_RU!,
  SITE_PROJECT_NOT_FOUND_EN: process.env.SITE_PROJECT_NOT_FOUND_EN!,
  SITE_PROJECT_DEFAULT_RU: process.env.SITE_PROJECT_DEFAULT_RU!,
  SITE_PROJECT_DEFAULT_EN: process.env.SITE_PROJECT_DEFAULT_EN!,
  NEXT_PUBLIC_DEV_MODE: process.env.NEXT_PUBLIC_DEV_MODE === "true",
  NEXT_PUBLIC_SOCIAL_LINKS: JSON.parse(process.env.NEXT_PUBLIC_SOCIAL_LINKS || '[]') as Array<{name: string, link: string, icon: string}>
};

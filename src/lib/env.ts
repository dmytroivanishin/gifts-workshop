import { logger } from "@/modules/logger";

const requiredEnvVars = [
  "DB_URI",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET_NAME",
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

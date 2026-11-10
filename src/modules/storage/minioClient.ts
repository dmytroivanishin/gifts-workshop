import { Client } from 'minio';
import { env } from "@/modules/core/env";
import { logger } from '@/modules/logger';

// Created on first use, not at import: `next build` loads this module to collect page data, when the
// S3 variables are not set, and a top-level `new URL(env.S3_ENDPOINT)` would fail the build.
let client: Client | undefined;

export function getMinioClient(): Client {
  if (!client) {
    const endpointUrl = new URL(env.S3_ENDPOINT);
    client = new Client({
      endPoint: endpointUrl.hostname,
      port: parseInt(endpointUrl.port) || (endpointUrl.protocol === 'https:' ? 443 : 80),
      useSSL: endpointUrl.protocol === 'https:',
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY
    });
  }
  return client;
}

export function getBucketName(): string {
  return env.S3_BUCKET_NAME;
}

function publicReadPolicy(bucketName: string): string {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicRead",
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucketName}/*`]
      }
    ]
  });
}

async function hasBucketPolicy(bucketName: string): Promise<boolean> {
  try {
    await getMinioClient().getBucketPolicy(bucketName);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "NoSuchBucketPolicy") return false;
    throw error;
  }
}

async function prepareBucket(): Promise<void> {
  const bucketName = getBucketName();
  const minio = getMinioClient();

  if (!(await minio.bucketExists(bucketName))) {
    await minio.makeBucket(bucketName, 'us-east-1');
    logger.info(`MinIO Bucket '${bucketName}' created successfully.`);
  }

  // Checked separately from creation: a bucket made by hand has no policy and its images would answer 403.
  // An existing policy is left alone so a stricter one set on purpose is not overwritten.
  if (!(await hasBucketPolicy(bucketName))) {
    await minio.setBucketPolicy(bucketName, publicReadPolicy(bucketName));
    logger.info(`MinIO Bucket '${bucketName}' policy set to public read.`);
  }
}

let bucketReady: Promise<void> | undefined;

// Called before the first upload of a process; a failure is not cached, so the next upload tries again
export function ensureBucket(): Promise<void> {
  bucketReady ??= prepareBucket().catch((error: unknown) => {
    bucketReady = undefined;
    logger.error("Failed to prepare MinIO bucket", {
      code: "MINIO_INIT_FAILED",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  });
  return bucketReady;
}

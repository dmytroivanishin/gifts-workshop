import { Client } from 'minio';
import { env } from "@/modules/core/env";
import { logger } from '@/modules/logger';

const endpointUrl = new URL(env.S3_ENDPOINT);

export const minioClient = new Client({
  endPoint: endpointUrl.hostname,
  port: parseInt(endpointUrl.port) || (endpointUrl.protocol === 'https:' ? 443 : 80),
  useSSL: endpointUrl.protocol === 'https:',
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY
});

export const BUCKET_NAME = env.S3_BUCKET_NAME;

const publicReadPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "PublicRead",
      Effect: "Allow",
      Principal: "*",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
    }
  ]
});

async function hasBucketPolicy(): Promise<boolean> {
  try {
    await minioClient.getBucketPolicy(BUCKET_NAME);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "NoSuchBucketPolicy") return false;
    throw error;
  }
}

async function prepareBucket(): Promise<void> {
  if (!(await minioClient.bucketExists(BUCKET_NAME))) {
    await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    logger.info(`MinIO Bucket '${BUCKET_NAME}' created successfully.`);
  }

  // Checked separately from creation: a bucket made by hand has no policy and its images would answer 403.
  // An existing policy is left alone so a stricter one set on purpose is not overwritten.
  if (!(await hasBucketPolicy())) {
    await minioClient.setBucketPolicy(BUCKET_NAME, publicReadPolicy);
    logger.info(`MinIO Bucket '${BUCKET_NAME}' policy set to public read.`);
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

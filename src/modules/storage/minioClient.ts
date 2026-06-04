import { Client } from 'minio';
import { env } from '@/lib/env';
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

// Ensure bucket exists on startup
export const initializeBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      logger.info(`MinIO Bucket '${BUCKET_NAME}' created successfully.`);
      
      // Make bucket public
      const policy = {
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
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      logger.info(`MinIO Bucket '${BUCKET_NAME}' policy set to public read.`);
    }
  } catch (error: any) {
    logger.error("Failed to initialize MinIO bucket", { code: "MINIO_INIT_FAILED", error: error.message });
  }
};

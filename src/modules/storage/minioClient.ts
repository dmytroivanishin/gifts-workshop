import { Client } from 'minio';

const endpointUrl = new URL(process.env.S3_ENDPOINT || 'http://localhost:9000');

export const minioClient = new Client({
  endPoint: endpointUrl.hostname,
  port: parseInt(endpointUrl.port) || (endpointUrl.protocol === 'https:' ? 443 : 80),
  useSSL: endpointUrl.protocol === 'https:',
  accessKey: process.env.S3_ACCESS_KEY || 'minio_admin',
  secretKey: process.env.S3_SECRET_KEY || 'minio_admin_password'
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'portfolio-media';

// Ensure bucket exists on startup
export const initializeBucket = async () => {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`✅ MinIO Bucket '${BUCKET_NAME}' created successfully.`);
      
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
      console.log(`✅ MinIO Bucket '${BUCKET_NAME}' policy set to public read.`);
    }
  } catch (error) {
    console.error("❌ Failed to initialize MinIO bucket:", error);
  }
};

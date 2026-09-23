import sharp from 'sharp';
import { randomUUID } from 'crypto';
import path from 'path';
import { env } from "@/modules/core/env";
import { minioClient, BUCKET_NAME, ensureBucket } from './minioClient';

// S3_ENDPOINT is the address the server connects to (an internal host inside Docker or Coolify), not necessarily one
// a browser can reach, and the stored URL ends up in the database, so the public address is a separate variable.
const PUBLIC_BASE_URL = `${new URL(env.S3_PUBLIC_URL).href.replace(/\/+$/, "")}/${BUCKET_NAME}`;

export interface ProcessedImageResult {
  originalUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  orientation: string;
}

export class StorageService {
  /**
   * Processes and uploads an image to MinIO (original and thumbnail).
   */
  async uploadImage(buffer: Buffer, originalFilename: string, mimeType: string): Promise<ProcessedImageResult> {
    const ext = path.extname(originalFilename).toLowerCase();
    const basename = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9]/g, '-');
    const timestamp = Date.now();
    const uuid = randomUUID();
    
    // Format: <uuid>-<timestamp>-<filename>.<ext>
    const uniqueOriginalName = `${uuid}-${timestamp}-${basename}${ext}`;
    const uniqueThumbnailName = `${uuid}-${timestamp}-${basename}-thumb${ext}`;

    // Process Original (Max 1000x1000)
    let originalPipeline = sharp(buffer)
      .resize({
        width: 1000,
        height: 1000,
        fit: 'inside', // Preserves aspect ratio, scales down if larger
        withoutEnlargement: true // Doesn't scale up if smaller than 1000x1000
      });

    // Process Thumbnail (Max 320x320)
    let thumbnailPipeline = sharp(buffer)
      .resize({
        width: 320,
        height: 320,
        fit: 'inside',
        withoutEnlargement: true
      });

    // Apply format-specific optimizations to reduce file sizes drastically
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      originalPipeline = originalPipeline.jpeg({ quality: 80, progressive: true });
      thumbnailPipeline = thumbnailPipeline.jpeg({ quality: 75, progressive: true });
    } else if (mimeType === 'image/png') {
      originalPipeline = originalPipeline.png({ compressionLevel: 9, palette: true });
      thumbnailPipeline = thumbnailPipeline.png({ compressionLevel: 9, palette: true });
    } else if (mimeType === 'image/webp') {
      originalPipeline = originalPipeline.webp({ quality: 80 });
      thumbnailPipeline = thumbnailPipeline.webp({ quality: 75 });
    }

    const originalBuffer = await originalPipeline.toBuffer();
    const thumbnailBuffer = await thumbnailPipeline.toBuffer();

    // Retrieve final dimensions after resize
    const processedMetadata = await sharp(originalBuffer).metadata();
    const finalWidth = processedMetadata.width || 0;
    const finalHeight = processedMetadata.height || 0;
    const orientation = finalWidth >= finalHeight ? 'landscape' : 'portrait';

    // Upload to MinIO
    await ensureBucket();
    await minioClient.putObject(BUCKET_NAME, uniqueOriginalName, originalBuffer, originalBuffer.length, {
      'Content-Type': mimeType
    });

    await minioClient.putObject(BUCKET_NAME, uniqueThumbnailName, thumbnailBuffer, thumbnailBuffer.length, {
      'Content-Type': mimeType
    });

    return {
      originalUrl: `${PUBLIC_BASE_URL}/${uniqueOriginalName}`,
      thumbnailUrl: `${PUBLIC_BASE_URL}/${uniqueThumbnailName}`,
      width: finalWidth,
      height: finalHeight,
      orientation
    };
  }
}

export const storageService = new StorageService();

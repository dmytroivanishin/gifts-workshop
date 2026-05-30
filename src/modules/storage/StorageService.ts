import sharp from 'sharp';
import { randomUUID } from 'crypto';
import path from 'path';
import { minioClient, BUCKET_NAME } from './minioClient';

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
    await minioClient.putObject(BUCKET_NAME, uniqueOriginalName, originalBuffer, originalBuffer.length, {
      'Content-Type': mimeType
    });

    await minioClient.putObject(BUCKET_NAME, uniqueThumbnailName, thumbnailBuffer, thumbnailBuffer.length, {
      'Content-Type': mimeType
    });

    // Construct public URLs
    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    const baseUrl = `${endpoint}/${BUCKET_NAME}`;

    return {
      originalUrl: `${baseUrl}/${uniqueOriginalName}`,
      thumbnailUrl: `${baseUrl}/${uniqueThumbnailName}`,
      width: finalWidth,
      height: finalHeight,
      orientation
    };
  }
}

export const storageService = new StorageService();

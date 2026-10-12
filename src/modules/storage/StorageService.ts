import sharp from 'sharp';
import { randomUUID } from 'crypto';
import path from 'path';
import { env } from "@/modules/core/env";
import { logger } from "@/modules/logger";
import { ValidationError } from "@/common/errors/validation";
import { minioClient, BUCKET_NAME, ensureBucket } from './minioClient';

// S3_ENDPOINT is the address the server connects to (an internal host inside Docker or Coolify), not necessarily one
// a browser can reach, and the stored URL ends up in the database, so the public address is a separate variable.
const PUBLIC_BASE_URL = `${new URL(env.S3_PUBLIC_URL).href.replace(/\/+$/, "")}/${BUCKET_NAME}`;

export interface ProcessedImageResult {
  originalUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  orientation: "Portrait" | "Landscape";
}

export class StorageService {
  /**
   * Processes and uploads an image to MinIO (original and thumbnail).
   */
  async uploadImage(buffer: Buffer, originalFilename: string): Promise<ProcessedImageResult> {
    // The client-declared MIME type and the filename extension are both fully spoofable; the only
    // trustworthy signal is the format sharp actually decodes from the bytes, so branch and name
    // the stored objects from that instead. An unsupported/undecodable file is a 400, not a 500
    // from inside sharp's resize/encode step.
    let format: string | undefined;
    try {
      format = (await sharp(buffer).metadata()).format;
    } catch {
      // sharp throws when it cannot even parse a header (not an image at all), rather than
      // returning metadata with no format
    }
    if (format !== 'jpeg' && format !== 'png') {
      throw new ValidationError("Unsupported image format. Only JPEG and PNG are allowed.", [
        { field: "file", message: `Detected format: ${format ?? "unknown"}` },
      ]);
    }
    const ext = format === 'jpeg' ? '.jpg' : '.png';
    const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

    const basename = path.basename(originalFilename, path.extname(originalFilename)).replace(/[^a-zA-Z0-9]/g, '-');
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
    if (format === 'jpeg') {
      originalPipeline = originalPipeline.jpeg({ quality: 80, progressive: true });
      thumbnailPipeline = thumbnailPipeline.jpeg({ quality: 75, progressive: true });
    } else {
      originalPipeline = originalPipeline.png({ compressionLevel: 9, palette: true });
      thumbnailPipeline = thumbnailPipeline.png({ compressionLevel: 9, palette: true });
    }

    const originalBuffer = await originalPipeline.toBuffer();
    const thumbnailBuffer = await thumbnailPipeline.toBuffer();

    // Retrieve final dimensions after resize
    const processedMetadata = await sharp(originalBuffer).metadata();
    const finalWidth = processedMetadata.width || 0;
    const finalHeight = processedMetadata.height || 0;
    const orientation = finalWidth >= finalHeight ? 'Landscape' : 'Portrait';

    // Upload to MinIO
    await ensureBucket();
    await minioClient.putObject(BUCKET_NAME, uniqueOriginalName, originalBuffer, originalBuffer.length, {
      'Content-Type': contentType
    });

    await minioClient.putObject(BUCKET_NAME, uniqueThumbnailName, thumbnailBuffer, thumbnailBuffer.length, {
      'Content-Type': contentType
    });

    return {
      originalUrl: `${PUBLIC_BASE_URL}/${uniqueOriginalName}`,
      thumbnailUrl: `${PUBLIC_BASE_URL}/${uniqueThumbnailName}`,
      width: finalWidth,
      height: finalHeight,
      orientation
    };
  }

  /**
   * Removes the original and thumbnail objects for a deleted media row. Best-effort: a media row
   * can also hold an externally hosted URL (saveMedia accepts those), so anything outside our own
   * PUBLIC_BASE_URL is left alone, and a MinIO failure is logged rather than thrown (the DB row is
   * already gone by the time this runs, so there is nothing left to roll back).
   */
  async deleteImage(originalUrl: string, thumbnailUrl: string): Promise<void> {
    const prefix = `${PUBLIC_BASE_URL}/`;
    const keys = [originalUrl, thumbnailUrl]
      .filter((url): url is string => !!url && url.startsWith(prefix))
      .map((url) => url.slice(prefix.length));

    await Promise.all(
      [...new Set(keys)].map((key) =>
        minioClient.removeObject(BUCKET_NAME, key).catch((error) => {
          logger.error("Failed to remove media object from MinIO", { code: "MINIO_DELETE_FAILED", key, error });
        })
      )
    );
  }
}

export const storageService = new StorageService();

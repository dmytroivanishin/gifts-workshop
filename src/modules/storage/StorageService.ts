import sharp from 'sharp';
import { env } from "@/modules/core/env";
import { generateMediaName, generateStorageSuffix } from "@/utils/mediaName";
import { logger } from "@/modules/logger";
import { ValidationError } from "@/common/errors/validation";
import { minioClient, BUCKET_NAME, ensureBucket } from './minioClient';

// S3_ENDPOINT is the address the server connects to (an internal host inside Docker or Coolify), not necessarily one
// a browser can reach, and the stored URL ends up in the database, so the public address is a separate variable.
const PUBLIC_BASE_URL = `${new URL(env.S3_PUBLIC_URL).href.replace(/\/+$/, "")}/${BUCKET_NAME}`;

// Optional, server-only sizing knobs (not NEXT_PUBLIC_* — sharp resizes on the server, nothing here
// reaches the browser bundle). Defaults match the values this pipeline has always used; override to
// experiment without a code change. Changing these only affects new uploads — existing media rows
// keep their already-stored, already-sized URLs.
const THUMBNAIL_MAX_PX = Number(process.env.MEDIA_THUMBNAIL_MAX_PX) || 320;
const PREVIEW_MAX_PX = Number(process.env.MEDIA_PREVIEW_MAX_PX) || 1000;

// A small file can decode into a huge bitmap (a "decompression bomb"): the 10 MB size cap does not bound
// memory, the pixel count does. 40 MP covers any phone camera.
const MAX_INPUT_PIXELS = 40_000_000;

export interface ProcessedImageResult {
  originalUrl: string;
  thumbnailUrl: string;
  displayName: string;
  width: number;
  height: number;
  orientation: "Portrait" | "Landscape";
}

export class StorageService {
  /**
   * Processes and uploads an image to MinIO (original and thumbnail).
   */
  async uploadImage(buffer: Buffer): Promise<ProcessedImageResult> {
    // The client-declared MIME type and the filename extension are both fully spoofable; the only
    // trustworthy signal is the format sharp actually decodes from the bytes. An unsupported or
    // undecodable file is a clean 400 (ValidationError), not a 500 from inside sharp's resize/encode
    // step. JPEG and PNG are the only accepted INPUT formats; the OUTPUT is always JPEG regardless
    // of which of the two was uploaded (below) — one content type, one extension, simpler pipeline.
    // Sharp flattens a PNG's alpha channel onto white automatically when encoding to JPEG.
    let format: string | undefined;
    let inputPixels = 0;
    try {
      const inputMetadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
      format = inputMetadata.format;
      inputPixels = (inputMetadata.width ?? 0) * (inputMetadata.height ?? 0);
    } catch {
      // sharp throws when it cannot even parse a header (not an image at all), rather than
      // returning metadata with no format
    }
    if (format !== 'jpeg' && format !== 'png') {
      throw new ValidationError("Unsupported image format. Only JPEG and PNG are allowed.", [
        { field: "file", message: `Detected format: ${format ?? "unknown"}` },
      ]);
    }
    if (inputPixels > MAX_INPUT_PIXELS) {
      throw new ValidationError("Image is too large in pixels.", [
        { field: "file", message: `At most ${MAX_INPUT_PIXELS / 1_000_000} megapixels are allowed.` },
      ]);
    }
    const ext = '.jpg';
    const contentType = 'image/jpeg';

    // <display-name>-<timestamp>-<suffix>/preview.jpg and .../thumb.jpg — grouped per upload,
    // with standard file names inside. The display name (not the original filename, which could
    // be anything, including non-Latin text that a plain ASCII sanitizer would reduce to nothing
    // useful) is persisted as-is on the media row (media.displayName) and is the admin media
    // grid's readable label; the timestamp plus the random suffix are only a collision-safety
    // margin and are never shown anywhere.
    const displayName = generateMediaName();
    const timestamp = Date.now();
    const suffix = generateStorageSuffix();
    const folderName = `${displayName}-${timestamp}-${suffix}`;
    const uniqueOriginalName = `${folderName}/preview${ext}`;
    const uniqueThumbnailName = `${folderName}/thumb${ext}`;

    // Process Preview (Max PREVIEW_MAX_PX x PREVIEW_MAX_PX)
    const originalPipeline = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({
        width: PREVIEW_MAX_PX,
        height: PREVIEW_MAX_PX,
        fit: 'inside', // Preserves aspect ratio, scales down if larger
        withoutEnlargement: true // Doesn't scale up if smaller than the max
      })
      .jpeg({ quality: 80, progressive: true });

    // Process Thumbnail (Max THUMBNAIL_MAX_PX x THUMBNAIL_MAX_PX)
    const thumbnailPipeline = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize({
        width: THUMBNAIL_MAX_PX,
        height: THUMBNAIL_MAX_PX,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 75, progressive: true });

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

    try {
      await minioClient.putObject(BUCKET_NAME, uniqueThumbnailName, thumbnailBuffer, thumbnailBuffer.length, {
        'Content-Type': contentType
      });
    } catch (error) {
      // Without this the preview stays in the bucket with no row pointing at it.
      await this.removeKeys([uniqueOriginalName]);
      throw error;
    }

    return {
      originalUrl: `${PUBLIC_BASE_URL}/${uniqueOriginalName}`,
      thumbnailUrl: `${PUBLIC_BASE_URL}/${uniqueThumbnailName}`,
      displayName,
      width: finalWidth,
      height: finalHeight,
      orientation
    };
  }

  // Best-effort removal of keys we just wrote; a failure is logged, not thrown, so the caller's original error wins.
  private async removeKeys(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((key) =>
        minioClient.removeObject(BUCKET_NAME, key).catch((error) => {
          logger.error("Failed to remove media object from MinIO", { code: "MINIO_DELETE_FAILED", key, error });
        })
      )
    );
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

    await this.removeKeys([...new Set(keys)]);
  }

  /**
   * Bulk-delete counterpart to deleteImage: one native S3 Multi-Object Delete call
   * (minioClient.removeObjects, already supported by the installed minio client) instead of a
   * per-row removeObject loop. Best-effort, same as deleteImage — the DB rows are already gone by
   * the time this runs, so a MinIO failure is logged, not thrown.
   */
  async deleteImages(items: { originalUrl: string; thumbnailUrl: string }[]): Promise<void> {
    const prefix = `${PUBLIC_BASE_URL}/`;
    const keys = new Set<string>();
    for (const { originalUrl, thumbnailUrl } of items) {
      for (const url of [originalUrl, thumbnailUrl]) {
        if (url && url.startsWith(prefix)) keys.add(url.slice(prefix.length));
      }
    }
    if (keys.size === 0) return;

    try {
      const results = await minioClient.removeObjects(BUCKET_NAME, [...keys]);
      const failures = results.filter((result) => result?.Error);
      if (failures.length > 0) {
        logger.error("Some media objects failed to remove from MinIO", { code: "MINIO_DELETE_FAILED", failures });
      }
    } catch (error) {
      logger.error("Failed to batch-remove media objects from MinIO", { code: "MINIO_DELETE_FAILED", error });
    }
  }
}

export const storageService = new StorageService();

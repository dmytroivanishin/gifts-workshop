import sharp from 'sharp';
import { generateMediaName, generateStorageSuffix } from "@/utils/mediaName";
import { logger } from "@/modules/logger";
import { createConcurrencyLimit } from "@/utils/concurrencyLimit";
import { ValidationError } from "@/common/errors/validation";
import { LocalFolderStorage } from "@/modules/storage/localFolderStorage";
import type { ProcessedImageResult } from "@/interfaces/storage";
import { mediaFolderRoot, mediaPublicBaseUrl } from "@/modules/storage/mediaFolder";

// Media files live in a folder on disk, served by Caddy under S3_PUBLIC_URL. Stored URLs keep the shape
// <S3_PUBLIC_URL>/<bucket>/<key>, so the stored paths stay stable.
// Created on first use, not at import: the build imports this module without the runtime env vars.
let storage: LocalFolderStorage | undefined;
function mediaStorage(): LocalFolderStorage {
  storage ??= new LocalFolderStorage(mediaFolderRoot());
  return storage;
}
const publicBaseUrl = mediaPublicBaseUrl;

// A write that takes longer than this is abandoned: a stalled disk must not hold an upload (and its memory) forever.
const WRITE_TIMEOUT_MS = 30_000;

// Optional, server-only sizing knobs (not NEXT_PUBLIC_* — sharp resizes on the server, nothing here
// reaches the browser bundle). Defaults match the values this pipeline has always used; override to
// experiment without a code change. Changing these only affects new uploads — existing media rows
// keep their already-stored, already-sized URLs.
const THUMBNAIL_MAX_PX = Number(process.env.MEDIA_THUMBNAIL_MAX_PX) || 320;
const PREVIEW_MAX_PX = Number(process.env.MEDIA_PREVIEW_MAX_PX) || 1000;
const THUMBNAIL_SHARPEN_SIGMA = 0.4;

// A small file can decode into a huge bitmap (a "decompression bomb"): the 10 MB size cap does not bound
// memory, the pixel count does. 40 MP covers any phone camera.
const MAX_INPUT_PIXELS = 40_000_000;

// At most two images are decoded at once. A 40 MP photo takes roughly 160 MB as a raw bitmap, so the
// number of parallel decodes sets the peak memory of the process; extra uploads wait their turn.
const runSharpJob = createConcurrencyLimit(2);

export class StorageService {
  /**
   * Processes and stores an image in the media folder (original and thumbnail).
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
      // Light unsharp mask after downscaling: small thumbnails look soft on high-density screens
      // otherwise. Tune sigma here (0.5–1.0 is the usable range); no size or quality change.
      .sharpen({ sigma: THUMBNAIL_SHARPEN_SIGMA })
      .jpeg({ quality: 85, progressive: true });

    // Only the decode-and-encode step holds whole bitmaps in memory, so it is the part that takes a slot.
    // The write to the media folder below is disk I/O and does not wait behind it.
    const { originalBuffer, thumbnailBuffer, finalWidth, finalHeight } = await runSharpJob(async () => {
      const resizedOriginal = await originalPipeline.toBuffer();
      const resizedThumbnail = await thumbnailPipeline.toBuffer();
      const processedMetadata = await sharp(resizedOriginal).metadata();
      return {
        originalBuffer: resizedOriginal,
        thumbnailBuffer: resizedThumbnail,
        finalWidth: processedMetadata.width || 0,
        finalHeight: processedMetadata.height || 0,
      };
    });
    const orientation = finalWidth >= finalHeight ? 'Landscape' : 'Portrait';

    // Write both files to the media folder. Each write has its own time limit.
    await mediaStorage().ensureReady();
    await mediaStorage().put(uniqueOriginalName, originalBuffer, { signal: AbortSignal.timeout(WRITE_TIMEOUT_MS) });

    try {
      await mediaStorage().put(uniqueThumbnailName, thumbnailBuffer, { signal: AbortSignal.timeout(WRITE_TIMEOUT_MS) });
    } catch (error) {
      // Without this the preview stays on disk with no row pointing at it.
      await this.removeKeys([uniqueOriginalName]);
      throw error;
    }

    return {
      originalUrl: `${publicBaseUrl()}/${uniqueOriginalName}`,
      thumbnailUrl: `${publicBaseUrl()}/${uniqueThumbnailName}`,
      displayName,
      width: finalWidth,
      height: finalHeight,
      orientation
    };
  }

  // Best-effort removal of keys; a failure is logged, not thrown, so the caller's original error wins.
  private async removeKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      const result = await mediaStorage().remove(keys);
      for (const failure of result.failed) {
        logger.error("Failed to remove media file", { code: "MEDIA_DELETE_FAILED", key: failure.key, reason: failure.reason });
      }
    } catch (error) {
      logger.error("Failed to remove media files", { code: "MEDIA_DELETE_FAILED", keys, error });
    }
  }

  /**
   * Removes the original and thumbnail objects for a deleted media row. Best-effort: a media row
   * can also hold an externally hosted URL (saveMedia accepts those), so anything outside our own
   * the public base URL is left alone, and a storage failure is logged rather than thrown (the DB row is
   * already gone by the time this runs, so there is nothing left to roll back).
   */
  async deleteImage(originalUrl: string, thumbnailUrl: string): Promise<void> {
    const prefix = `${publicBaseUrl()}/`;
    const keys = [originalUrl, thumbnailUrl]
      .filter((url): url is string => !!url && url.startsWith(prefix))
      .map((url) => url.slice(prefix.length));

    await this.removeKeys([...new Set(keys)]);
  }

  /**
   * Bulk-delete counterpart to deleteImage: collects every key first and removes them in one call.
   * Best-effort, same as deleteImage — the DB rows are already gone by the time this runs, so a
   * failure is logged, not thrown.
   */
  async deleteImages(items: { originalUrl: string; thumbnailUrl: string }[]): Promise<void> {
    const prefix = `${publicBaseUrl()}/`;
    const keys = new Set<string>();
    for (const { originalUrl, thumbnailUrl } of items) {
      for (const url of [originalUrl, thumbnailUrl]) {
        if (url && url.startsWith(prefix)) keys.add(url.slice(prefix.length));
      }
    }
    await this.removeKeys([...keys]);
  }
}

export const storageService = new StorageService();

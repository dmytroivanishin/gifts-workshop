import { IMediaRepository, IPostRepository } from "@/repositories/interfaces";
import { IMediaService } from "./interfaces";
import { Media, Post } from "@/types";
import { randomUUID } from "crypto";
import { paginate } from "./pagination";
import { ConflictError } from "@/common/errors/conflict";
import { storageService } from "@/modules/storage/StorageService";
import { drizzleDatabase } from "@/repositories/drizzle/database";
import { posts, postsToMedia } from "@/repositories/drizzle/schema";
import { eq, sql } from "drizzle-orm";

// A generous ceiling, well above any real product-photo batch; it exists to stop a single request
// from processing an unbounded number of files (each goes through sharp + two MinIO uploads), not
// to cap normal admin work. Configurable via MAX_FILES_PER_UPLOAD (optional; same fallback pattern
// as NEXT_PUBLIC_MAX_FILE_SIZE_MB below, so a missing value in config/test.env doesn't break env.ts).
export const MAX_FILES_PER_UPLOAD = Number(process.env.MAX_FILES_PER_UPLOAD) || 50;

export class MediaService implements IMediaService {
  constructor(
    private mediaRepo: IMediaRepository,
    private postRepo: IPostRepository
  ) { }

  async getAllMedia(options?: any): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const mediaList = await this.mediaRepo.getAll({
      page,
      limit: limit + 1,
      offset: (page - 1) * limit,
    });

    return paginate(mediaList, { page, limit });
  }

  async uploadAndSaveMedia(buffer: Buffer, originalFilename: string, _mimeType: string, userId: string): Promise<Media> {
    // _mimeType is kept for the interface contract; StorageService now derives the real format
    // from the decoded bytes instead of trusting the client-declared type (CP-6 hardening).
    const processed = await storageService.uploadImage(buffer, originalFilename);
    
    const media: Media = {
      id: randomUUID(),
      thumbnailUrl: processed.thumbnailUrl,
      originalUrl: processed.originalUrl,
      width: processed.width,
      height: processed.height,
      orientation: processed.orientation as "Portrait" | "Landscape",
      userId: userId,
    };

    return this.mediaRepo.save(media);
  }

  async uploadMultiple(files: File[], userId: string): Promise<Media[]> {
    const maxFileSizeBytes = (Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    
    if (!files || files.length === 0) {
      throw new ConflictError("No files provided", "VALIDATION_ERROR");
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      throw new ConflictError(`Too many files in one upload. Max is ${MAX_FILES_PER_UPLOAD}.`, "VALIDATION_ERROR");
    }

    const savedMedia: Media[] = [];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        throw new ConflictError(`Invalid file type: ${file.name}. Only JPG and PNG are allowed.`, "VALIDATION_ERROR");
      }
      if (file.size > maxFileSizeBytes) {
        throw new ConflictError(`File ${file.name} is too large. Max size is ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 10}MB.`, "VALIDATION_ERROR");
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const media = await this.uploadAndSaveMedia(buffer, file.name, file.type, userId);
      savedMedia.push(media);
    }

    return savedMedia;
  }

  async getMediaById(id: string): Promise<Media | undefined> {
    return this.mediaRepo.getById(id);
  }

  async saveMedia(body: any): Promise<Media> {
    const id = body.id || randomUUID();
    const media: Media = {
      id,
      thumbnailUrl: body.thumbnailUrl || body.originalUrl,
      originalUrl: body.originalUrl,
      width: body.width,
      height: body.height,
      orientation: body.orientation,
      userId: body.userId,
    };
    return this.mediaRepo.save(media);
  }

  async deleteMedia(id: string): Promise<boolean> {
    const db = drizzleDatabase.getDb();
    
    const [{ posterCount }] = await db
      .select({ posterCount: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.posterId, id));
      
    if (Number(posterCount) > 0) {
      throw new ConflictError("Cannot delete media because it is used in a post.", "MEDIA_IN_USE");
    }
    
    const [{ galleryCount }] = await db
      .select({ galleryCount: sql<number>`count(*)` })
      .from(postsToMedia)
      .where(eq(postsToMedia.mediaId, id));
      
    if (Number(galleryCount) > 0) {
      throw new ConflictError("Cannot delete media because it is used in a post.", "MEDIA_IN_USE");
    }

    const media = await this.mediaRepo.getById(id);
    const deleted = await this.mediaRepo.delete(id);

    if (deleted && media) {
      await storageService.deleteImage(media.originalUrl, media.thumbnailUrl);
    }

    return deleted;
  }
}

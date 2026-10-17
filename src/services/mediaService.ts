import { IMediaRepository, IPostRepository } from "@/repositories/interfaces";
import { IMediaService } from "./interfaces";
import { Media, PaginatedResult, PaginationOptions } from "@/types";
import { randomUUID } from "crypto";
import { paginate } from "./pagination";
import { ConflictError } from "@/common/errors/conflict";
import { storageService } from "@/modules/storage/StorageService";

export class MediaService implements IMediaService {
  constructor(
    private mediaRepo: IMediaRepository,
    private postRepo: IPostRepository
  ) { }

  async getAllMedia(options?: PaginationOptions): Promise<PaginatedResult<Media>> {
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
      orientation: processed.orientation,
      userId: userId,
    };

    return this.mediaRepo.save(media);
  }

  async uploadMedia(file: File, userId: string): Promise<Media> {
    const maxFileSizeBytes = (Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];

    if (!allowedTypes.includes(file.type)) {
      throw new ConflictError(`Invalid file type: ${file.name}. Only JPG and PNG are allowed.`, "VALIDATION_ERROR");
    }
    if (file.size > maxFileSizeBytes) {
      throw new ConflictError(`File ${file.name} is too large. Max size is ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 10}MB.`, "VALIDATION_ERROR");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return this.uploadAndSaveMedia(buffer, file.name, file.type, userId);
  }

  async getMediaById(id: string): Promise<Media | undefined> {
    return this.mediaRepo.getById(id);
  }

  async saveMedia(body: Omit<Media, "id" | "userId"> & { id?: string; userId?: string }): Promise<Media> {
    const id = body.id || randomUUID();
    const media: Media = {
      id,
      thumbnailUrl: body.thumbnailUrl || body.originalUrl,
      originalUrl: body.originalUrl,
      width: body.width,
      height: body.height,
      orientation: body.orientation,
      // Route-level withAdminAuth() already guarantees an authenticated admin before this runs.
      userId: body.userId!,
    };
    return this.mediaRepo.save(media);
  }

  async deleteMedia(id: string): Promise<boolean> {
    const posterCount = await this.postRepo.countByPoster(id);
    if (posterCount > 0) {
      throw new ConflictError("Cannot delete media because it is used in a post.", "MEDIA_IN_USE");
    }

    const galleryCount = await this.postRepo.countGalleryUsage(id);
    if (galleryCount > 0) {
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

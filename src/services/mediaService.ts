import { IMediaRepository, IPostRepository, MediaQueryOptions } from "@/repositories/interfaces";
import { IMediaService } from "./interfaces";
import { Media, PaginatedResult } from "@/types";
import { randomUUID } from "crypto";
import { paginate } from "./pagination";
import { ConflictError } from "@/common/errors/conflict";
import { storageService } from "@/modules/storage/StorageService";
import { generateMediaName } from "@/utils/mediaName";

export class MediaService implements IMediaService {
  constructor(
    private mediaRepo: IMediaRepository,
    private postRepo: IPostRepository
  ) { }

  async getAllMedia(options?: MediaQueryOptions): Promise<PaginatedResult<Media>> {
    // Same "no page/limit args = everything" convention as tagService/categoryService: the
    // admin media library has never been paginated (it loads the whole list), only `search`
    // narrows it. A caller that does pass page/limit still gets real pagination.
    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const mediaList = await this.mediaRepo.getAll({
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
        search: options.search,
      });

      return paginate(mediaList, { page, limit });
    }

    const mediaList = await this.mediaRepo.getAll({ search: options?.search });
    return paginate(mediaList, { page: 1, limit: mediaList.length });
  }

  async uploadAndSaveMedia(buffer: Buffer, _mimeType: string, userId: string): Promise<Media> {
    // _mimeType is kept for the interface contract; StorageService now derives the real format
    // from the decoded bytes instead of trusting the client-declared type (CP-6 hardening).
    const processed = await storageService.uploadImage(buffer);
    
    const media: Media = {
      id: randomUUID(),
      displayName: processed.displayName,
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

    return this.uploadAndSaveMedia(buffer, file.type, userId);
  }

  async getMediaById(id: string): Promise<Media | undefined> {
    return this.mediaRepo.getById(id);
  }

  async saveMedia(body: Omit<Media, "id" | "userId" | "displayName"> & { id?: string; userId?: string }): Promise<Media> {
    const id = body.id || randomUUID();
    const media: Media = {
      id,
      // This JSON path never runs through StorageService (it exists for externally hosted
      // URLs), so there's no upload-time display name to carry over — generate one directly.
      displayName: generateMediaName(),
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

  async bulkDeleteMedia(ids: string[]): Promise<{ deleted: string[]; blocked: { id: string; reason: string }[] }> {
    const uniqueIds = [...new Set(ids)];

    // One batched check across every requested id (findUsedMediaIds), instead of the two
    // per-id checks deleteMedia() above runs in a loop — the same in-use protection, just
    // evaluated once for the whole request. An id already deleted/never existed ends up neither
    // deleted nor blocked below; the caller only needs to know what did and didn't happen.
    const usedIds = await this.postRepo.findUsedMediaIds(uniqueIds);
    const blocked = uniqueIds
      .filter((id) => usedIds.has(id))
      .map((id) => ({ id, reason: "MEDIA_IN_USE" }));
    const candidateIds = uniqueIds.filter((id) => !usedIds.has(id));

    if (candidateIds.length === 0) {
      return { deleted: [], blocked };
    }

    // Object URLs are needed to clean up MinIO, so fetch the rows before deleting them.
    const mediaRows = await this.mediaRepo.getByIds(candidateIds);
    const deleted = await this.mediaRepo.deleteMany(candidateIds);
    const deletedSet = new Set(deleted);

    const rowsToPurge = mediaRows.filter((m) => deletedSet.has(m.id));
    if (rowsToPurge.length > 0) {
      await storageService.deleteImages(
        rowsToPurge.map((m) => ({ originalUrl: m.originalUrl, thumbnailUrl: m.thumbnailUrl }))
      );
    }

    return { deleted, blocked };
  }
}

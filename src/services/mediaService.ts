import { IMediaRepository, IPostRepository } from "@/repositories/interfaces";
import { IMediaService } from "./interfaces";
import { Media, Post } from "@/types";
import { randomUUID } from "crypto";
import { paginate } from "./pagination";
import { ConflictError } from "@/common/errors/conflict";
import { storageService } from "@/modules/storage/StorageService";

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

  async uploadAndSaveMedia(buffer: Buffer, originalFilename: string, mimeType: string, userId: string): Promise<Media> {
    const processed = await storageService.uploadImage(buffer, originalFilename, mimeType);
    
    const media: Media = {
      id: randomUUID(),
      thumbnailUrl: processed.thumbnailUrl,
      originalUrl: processed.originalUrl,
      width: processed.width,
      height: processed.height,
      orientation: processed.orientation as "Portrait" | "Landscape",
      userId: userId,
      position: { x: 0, y: 0, zoom: 1 } // Default positions for posts
    };

    return this.mediaRepo.save(media);
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
      position: body.position || { x: 0, y: 0, zoom: 1 },
      userId: body.userId,
    };
    return this.mediaRepo.save(media);
  }

  async deleteMedia(id: string): Promise<boolean> {
    const posterPosts = await this.postRepo.getByQuery({ poster: id });
    const mediaPosts = await this.postRepo.getByQuery({ "media.media": id });

    if (posterPosts.length > 0 || mediaPosts.length > 0) {
      throw new ConflictError("Cannot delete media that is in use by a post.");
    }

    return this.mediaRepo.delete(id);
  }
}

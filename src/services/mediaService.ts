import { IMediaRepository, IPostRepository } from "@/repositories/interfaces";
import { IMediaService } from "./interfaces";
import { Media, Post } from "@/types";
import { randomUUID } from "crypto";
import { paginate } from "./pagination";
import { ConflictError } from "@/common/errors/conflict";

export class MediaService implements IMediaService {
  constructor(
    private mediaRepo: IMediaRepository,
    private postRepo: IPostRepository
  ) {}

  async getAllMedia(options?: any): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const mediaList = await this.mediaRepo.getAll({
      page,
      limit: limit + 1,
    });

    return paginate(mediaList, { page, limit });
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

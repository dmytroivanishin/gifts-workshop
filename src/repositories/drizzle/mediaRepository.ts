import { DrizzleBaseRepository } from "./baseRepository";
import { media } from "./schema";
import { Media } from "@/types";
import { IMediaRepository } from "../interfaces";

export class MediaRepository extends DrizzleBaseRepository<Media, Media> implements IMediaRepository {
  constructor() {
    super(media as any);
  }

  async populate(item: any): Promise<Media> {
    return item as Media;
  }
}

export const mediaRepository = new MediaRepository();

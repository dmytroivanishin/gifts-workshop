import { DrizzleBaseRepository } from "./baseRepository";
import { media } from "./schema";
import { Media } from "@/types";
import { IMediaRepository } from "../interfaces";

export class MediaRepository extends DrizzleBaseRepository<Media, Media> implements IMediaRepository {
  constructor() {
    super(media);
  }

  async populate(item: typeof media.$inferSelect): Promise<Media> {
    return item as Media;
  }
}

export const mediaRepository = new MediaRepository();

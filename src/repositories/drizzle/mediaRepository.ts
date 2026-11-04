import { DrizzleBaseRepository } from "./baseRepository";
import { media } from "./schema";
import { Media } from "@/types";
import { desc } from "drizzle-orm";
import { IMediaRepository } from "../interfaces";

export class MediaRepository extends DrizzleBaseRepository<Media, Media> implements IMediaRepository {
  constructor() {
    super(media);
  }

  async populate(item: typeof media.$inferSelect): Promise<Media> {
    return item as Media;
  }

  protected override getOrderBy() {
    return desc(media.createdAt);
  }
}

export const mediaRepository = new MediaRepository();

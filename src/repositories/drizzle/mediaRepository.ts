import { DrizzleBaseRepository } from "./baseRepository";
import { media } from "./schema";
import { Media } from "@/types";
import { desc, sql } from "drizzle-orm";
import { IMediaRepository, MediaQueryOptions } from "../interfaces";

export class MediaRepository extends DrizzleBaseRepository<Media, Media, MediaQueryOptions> implements IMediaRepository {
  constructor() {
    super(media);
  }

  async populate(item: typeof media.$inferSelect): Promise<Media> {
    return item as Media;
  }

  protected override getOrderBy() {
    return desc(media.createdAt);
  }

  protected override buildFilter(options?: MediaQueryOptions) {
    if (!options?.search) return undefined;
    // Escape ILIKE wildcards so a literal "%"/"_" is matched literally, same convention
    // tagRepository.ts/postRepository.ts's `search` already use. displayName is a plain
    // varchar (not JSONB like tags.name/posts.title), so no "::text" cast is needed here.
    const escapedSearch = options.search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escapedSearch}%`;
    return sql`${media.displayName} ILIKE ${pattern}`;
  }
}

export const mediaRepository = new MediaRepository();

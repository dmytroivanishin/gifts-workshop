import { DrizzleBaseRepository } from "./baseRepository";
import { media } from "./schema";
import { Media } from "@/types";
import { desc, eq, sql } from "drizzle-orm";
import { IMediaRepository, MediaQueryOptions } from "../interfaces";
import { drizzleDatabase } from "./database";

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

  async findByContentHash(hash: string): Promise<Media | undefined> {
    const records = await drizzleDatabase.getDb().select().from(media).where(eq(media.contentHash, hash)).limit(1);
    if (!records.length) return undefined;
    return this.populate(records[0]);
  }
}

export const mediaRepository = new MediaRepository();

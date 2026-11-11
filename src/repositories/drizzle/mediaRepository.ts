import { DrizzleBaseRepository } from "./baseRepository";
import { media } from "./schema";
import { Media } from "@/types";
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { IMediaRepository, MediaQueryOptions } from "@/interfaces/repositories";
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

  async findUrlsIn(urls: string[]): Promise<string[]> {
    if (urls.length === 0) return [];
    // Only the two URL columns are read. The URL columns have no index, so each batch scans the table once;
    // at this project's size that is cheap, and a batch of 500 keeps every query small.
    const records = await drizzleDatabase
      .getDb()
      .select({ originalUrl: media.originalUrl, thumbnailUrl: media.thumbnailUrl })
      .from(media)
      .where(or(inArray(media.originalUrl, urls), inArray(media.thumbnailUrl, urls)));
    const wanted = new Set(urls);
    const found: string[] = [];
    for (const record of records) {
      for (const url of [record.originalUrl, record.thumbnailUrl]) {
        if (wanted.has(url)) found.push(url);
      }
    }
    return found;
  }
}

export const mediaRepository = new MediaRepository();

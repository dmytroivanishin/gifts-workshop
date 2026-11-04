import { DrizzleBaseRepository } from "./baseRepository";
import { tags } from "./schema";
import { Tag } from "@/types";
import { drizzleDatabase } from "./database";
import { eq, desc, sql } from "drizzle-orm";
import { ITagRepository, TagQueryOptions } from "../interfaces";

export class TagRepository extends DrizzleBaseRepository<Tag, Tag, TagQueryOptions> implements ITagRepository {
  constructor() {
    super(tags);
  }

  async populate(item: typeof tags.$inferSelect): Promise<Tag> {
    return item as Tag;
  }

  protected override getOrderBy() {
    return desc(tags.createdAt);
  }

  protected override buildFilter(options?: TagQueryOptions) {
    if (!options?.search) return undefined;
    // Escape ILIKE wildcards so a literal "%"/"_" is matched literally, same convention
    // postRepository.ts's `search` already uses; "\" is Postgres's default LIKE escape char.
    const escapedSearch = options.search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escapedSearch}%`;
    return sql`${tags.name}::text ILIKE ${pattern}`;
  }

  async getBySlug(slug: string): Promise<Tag | undefined> {
    const records = await drizzleDatabase.getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1);
    return records.length ? this.populate(records[0]) : undefined;
  }
}

export const tagRepository = new TagRepository();

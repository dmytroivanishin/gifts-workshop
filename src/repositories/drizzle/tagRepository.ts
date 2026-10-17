import { DrizzleBaseRepository } from "./baseRepository";
import { tags } from "./schema";
import { Tag } from "@/types";
import { drizzleDatabase } from "./database";
import { eq } from "drizzle-orm";
import { ITagRepository } from "../interfaces";

export class TagRepository extends DrizzleBaseRepository<Tag, Tag> implements ITagRepository {
  constructor() {
    super(tags);
  }

  async populate(item: typeof tags.$inferSelect): Promise<Tag> {
    return item as Tag;
  }

  async getBySlug(slug: string): Promise<Tag | undefined> {
    const records = await drizzleDatabase.getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1);
    return records.length ? this.populate(records[0]) : undefined;
  }
}

export const tagRepository = new TagRepository();

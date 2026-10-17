import { DrizzleBaseRepository } from "./baseRepository";
import { collections } from "./schema";
import { Collection } from "@/types";
import { drizzleDatabase } from "./database";
import { eq } from "drizzle-orm";
import { ICollectionRepository } from "../interfaces";

export class CollectionRepository extends DrizzleBaseRepository<Collection, Collection> implements ICollectionRepository {
  constructor() {
    super(collections);
  }

  async populate(item: typeof collections.$inferSelect): Promise<Collection> {
    return item as Collection;
  }

  async getBySlug(slug: string): Promise<Collection | undefined> {
    const records = await drizzleDatabase.getDb().select().from(collections).where(eq(collections.slug, slug)).limit(1);
    return records.length ? this.populate(records[0]) : undefined;
  }
}

export const collectionRepository = new CollectionRepository();

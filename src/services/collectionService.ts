import { ICollectionRepository } from "@/repositories/interfaces";
import { ICollectionService } from "./interfaces";
import { Collection, PaginatedResult, PaginationOptions } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/utils/slug";
import { isUUID } from "@/utils/uuid";
import { ConflictError } from "@/common/errors/conflict";
import { drizzleDatabase } from "@/repositories/drizzle/database";
import { posts, categories as categoriesSchema } from "@/repositories/drizzle/schema";
import { eq, sql } from "drizzle-orm";

import { paginate } from "./pagination";

export class CollectionService implements ICollectionService {
  constructor(
    private collectionRepo: ICollectionRepository
  ) {}

  async getAllCollections(options?: PaginationOptions): Promise<PaginatedResult<Collection>> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const collections = await this.collectionRepo.getAll({
      page,
      limit: limit + 1,
      offset: (page - 1) * limit,
    });

    return paginate(collections, { page, limit });
  }

  async getCollectionById(id: string): Promise<Collection | undefined> {
    if (isUUID(id)) {
      return this.collectionRepo.getById(id);
    }
    return this.collectionRepo.getBySlug(id);
  }

  async getCollectionBySlug(slug: string): Promise<Collection | undefined> {
    return this.collectionRepo.getBySlug(slug);
  }

  async saveCollection(body: { id?: string; title: Collection["title"]; description?: Collection["description"]; main?: boolean; slug?: string; userId?: string }): Promise<Collection> {
    const id = body.id || randomUUID();
    
    let slug = body.slug;
    if (!slug) {
      slug = await generateUniqueSlug(body.title, id, this.collectionRepo.getBySlug.bind(this.collectionRepo));
    }

    const collection: Collection = {
      id,
      title: body.title,
      description: body.description as Collection["description"],
      main: body.main ?? false,
      slug,
    };

    return this.collectionRepo.save(collection);
  }

  async deleteCollection(id: string): Promise<boolean> {
    const db = drizzleDatabase.getDb();
    
    const [{ postCount }] = await db
      .select({ postCount: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.collectionId, id));
      
    if (Number(postCount) > 0) {
      throw new ConflictError("Cannot delete collection because it is linked to posts.", "COLLECTION_HAS_POSTS");
    }
    
    const [{ categoryCount }] = await db
      .select({ categoryCount: sql<number>`count(*)` })
      .from(categoriesSchema)
      .where(eq(categoriesSchema.collectionId, id));
      
    if (Number(categoryCount) > 0) {
      throw new ConflictError("Cannot delete collection because it is linked to categories.", "COLLECTION_HAS_CATEGORIES");
    }

    return this.collectionRepo.delete(id);
  }
}


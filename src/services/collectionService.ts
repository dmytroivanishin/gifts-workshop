import { ICollectionRepository } from "@/repositories/interfaces";
import { ICollectionService } from "./interfaces";
import { Collection } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/lib/slug";
import { isUUID } from "@/lib/utils";
import { ConflictError } from "@/common/errors/conflict";
import { drizzleDatabase } from "@/repositories/drizzle/database";
import { posts, categories as categoriesSchema } from "@/repositories/drizzle/schema";
import { eq, sql } from "drizzle-orm";

import { paginate } from "./pagination";

export class CollectionService implements ICollectionService {
  constructor(
    private collectionRepo: ICollectionRepository
  ) {}

  async getAllCollections(options?: any): Promise<any> {
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

  async saveCollection(body: any): Promise<Collection> {
    const id = body.id || randomUUID();
    
    let slug = body.slug;
    if (!slug) {
      slug = await generateUniqueSlug(body.title, id, this.collectionRepo.getBySlug.bind(this.collectionRepo));
    }

    const collection: Collection = {
      id,
      title: typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" },
      description: typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" },
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
      throw new ConflictError("Невозможно удалить коллекцию, так как к ней привязаны посты.", "COLLECTION_HAS_POSTS");
    }
    
    const [{ categoryCount }] = await db
      .select({ categoryCount: sql<number>`count(*)` })
      .from(categoriesSchema)
      .where(eq(categoriesSchema.collectionId, id));
      
    if (Number(categoryCount) > 0) {
      throw new ConflictError("Невозможно удалить коллекцию, так как к ней привязаны категории.", "COLLECTION_HAS_CATEGORIES");
    }

    return this.collectionRepo.delete(id);
  }
}


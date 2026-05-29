import { DrizzleBaseRepository } from "./baseRepository";
import { posts } from "./schema";
import { Post, PopulatedPost, PaginationOptions } from "@/types";
import { drizzleDatabase } from "./database";
import { eq, and, sql, ilike } from "drizzle-orm";
import { IPostRepository, QueryOptions } from "../interfaces";

export class PostRepository extends DrizzleBaseRepository<Post, PopulatedPost, QueryOptions> implements IPostRepository {
  constructor() {
    super(posts as any);
  }

  async populate(item: any, options?: { populate?: string }): Promise<PopulatedPost> {
    return item as PopulatedPost;
  }

  async getBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedPost | undefined> {
    const records = await drizzleDatabase.getDb().select().from(posts).where(eq(posts.slug, slug)).limit(1);
    if (!records.length) return undefined;
    return this.populate(records[0], options);
  }

  async getByQuery(query: Record<string, any>, options?: PaginationOptions & { populate?: string }): Promise<PopulatedPost[]> {
    let sqlQuery = drizzleDatabase.getDb().select().from(posts).$dynamic();
    
    // Functional query building without deeply nested logic
    const conditions = [];

    if (query.categoryId) conditions.push(eq(posts.categoryId, query.categoryId));
    if (query.collectionId) conditions.push(eq(posts.collectionId, query.collectionId));
    if (query.status) conditions.push(eq(posts.status, query.status));
    if (query.inStock !== undefined) conditions.push(eq(posts.inStock, query.inStock));
    
    // Search in JSONB localized title dynamically (PostgreSQL native JSON cast)
    if (query.search) {
      conditions.push(sql`${posts.title}::text ILIKE ${`%${query.search}%`}`);
    }

    if (conditions.length > 0) {
      sqlQuery = sqlQuery.where(and(...conditions));
    }

    if (options?.limit) {
      sqlQuery = sqlQuery.limit(options.limit);
      if (options?.page) {
        sqlQuery = sqlQuery.offset((options.page - 1) * options.limit);
      }
    }

    const records = await sqlQuery;
    return Promise.all(records.map(r => this.populate(r, options)));
  }
}

export const postRepository = new PostRepository();

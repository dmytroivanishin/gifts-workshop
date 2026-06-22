import { DrizzleBaseRepository } from "./baseRepository";
import { posts, postsToTags, tags, media, postsToMedia } from "./schema";
import { Post, PopulatedPost, PaginationOptions } from "@/types";
import { drizzleDatabase } from "./database";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { IPostRepository, QueryOptions } from "../interfaces";

type PostRecord = typeof posts.$inferSelect & {
  postsToTags?: { tag: typeof tags.$inferSelect }[];
  postsToMedia?: { 
    order: number;
    position?: any;
    media: typeof media.$inferSelect;
  }[];
  [key: string]: any;
};

export class PostRepository extends DrizzleBaseRepository<Post, PopulatedPost, QueryOptions> implements IPostRepository {
  constructor() {
    super(posts as any);
  }

  private mapToPopulated(record: PostRecord): PopulatedPost {
    if (!record) return record as any;
    const tagsList = record.postsToTags?.map((pt: any) => pt.tag) || [];
    
    const mediaList = record.postsToMedia?.map((pm: any) => ({
      id: pm.media.id,
      order: pm.order,
      mediaId: pm.media.id,
      position: pm.position,
      media: pm.media
    })) || [];
    
    mediaList.sort((a: any, b: any) => a.order - b.order);
    const { postsToTags, postsToMedia, ...restRecord } = record as any;

    return {
      ...restRecord,
      media: mediaList,
      tags: tagsList,
      tagsIds: tagsList.map((t: any) => t.id),
    } as PopulatedPost;
  }

  private getWithRelations() {
    return {
      poster: true as const,
      collection: true as const,
      category: {
        with: {
          color: true as const,
          collection: true as const,
          parent: true as const,
        }
      },
      postsToTags: {
        with: { tag: true as const }
      },
      postsToMedia: {
        with: { media: true as const }
      }
    };
  }

  private getListRelations() {
    return {
      poster: true as const,
      category: {
        with: {
          color: true as const,
        }
      },
      postsToMedia: {
        with: { media: true as const }
      }
    };
  }

  async populate(item: any): Promise<PopulatedPost> {
    if (!item) return item;
    const results = await this.getById(item.id);
    if (!results) return item;
    return results;
  }

  override async getAll(options?: QueryOptions): Promise<PopulatedPost[]> {
    if (options && Object.keys(options).some(k => !['page', 'limit', 'offset'].includes(k))) {
      return this.getByQuery(options, options);
    }

    const db = drizzleDatabase.getDb();
    const queryOptions: any = {
      with: this.getListRelations(),
      orderBy: [desc(posts.createdAt)]
    };
    
    if (options?.limit) {
      queryOptions.limit = options.limit;
      if (options?.page) {
        queryOptions.offset = (options.page - 1) * options.limit;
      }
    }

    const records = await db.query.posts.findMany(queryOptions);
    return records.map(this.mapToPopulated.bind(this));
  }

  override async getById(id: string): Promise<PopulatedPost | undefined> {
    const record = await drizzleDatabase.getDb().query.posts.findFirst({
      where: eq(posts.id, id),
      with: this.getWithRelations()
    });
    return record ? this.mapToPopulated(record as any) : undefined;
  }

  override async getByIds(ids: string[]): Promise<PopulatedPost[]> {
    if (!ids.length) return [];
    const records = await drizzleDatabase.getDb().query.posts.findMany({
      where: inArray(posts.id, ids),
      with: this.getWithRelations()
    });
    return records.map(this.mapToPopulated.bind(this));
  }

  async getBySlug(slug: string): Promise<PopulatedPost | undefined> {
    const record = await drizzleDatabase.getDb().query.posts.findFirst({
      where: eq(posts.slug, slug),
      with: this.getWithRelations()
    });
    return record ? this.mapToPopulated(record as any) : undefined;
  }

  async getByQuery(query: Record<string, any>, options?: PaginationOptions): Promise<PopulatedPost[]> {
    const db = drizzleDatabase.getDb();
    
    const conditions = [];

    if (query.categoryId) {
      if (Array.isArray(query.categoryId)) {
        conditions.push(inArray(posts.categoryId, query.categoryId));
      } else {
        conditions.push(eq(posts.categoryId, query.categoryId));
      }
    }
    if (query.collectionId) conditions.push(eq(posts.collectionId, query.collectionId));
    if (query.status) conditions.push(eq(posts.status, query.status));
    if (query.inStock !== undefined) conditions.push(eq(posts.inStock, query.inStock));
    
    if (query.search) {
      conditions.push(sql`${posts.title}::text ILIKE ${`%${query.search}%`}`);
    }

    const queryOptions: any = {
      with: this.getListRelations(),
      orderBy: [desc(posts.createdAt)]
    };

    if (conditions.length > 0) {
      queryOptions.where = and(...conditions);
    }

    if (options?.limit) {
      queryOptions.limit = options.limit;
      if (options?.offset !== undefined) {
        queryOptions.offset = options.offset;
      } else if (options?.page) {
        queryOptions.offset = (options.page - 1) * options.limit;
      }
    }

    const records = await db.query.posts.findMany(queryOptions);
    return records.map(this.mapToPopulated.bind(this));
  }

  override async save(item: Post & { tagsIds?: string[] }): Promise<PopulatedPost> {
    const db = drizzleDatabase.getDb();
    const existing = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, item.id)).limit(1);

    const { tagsIds, media: postMediaItems, ...postData } = item as any;

    let savedId: string = "";

    await db.transaction(async (tx) => {
      if (existing.length) {
        const [updated] = await tx.update(posts).set(postData).where(eq(posts.id, item.id)).returning();
        savedId = updated.id;
      } else {
        const [inserted] = await tx.insert(posts).values(postData).returning();
        savedId = inserted.id;
      }

      if (tagsIds) {
        const existingTags = await tx.select({ tagId: postsToTags.tagId }).from(postsToTags).where(eq(postsToTags.postId, savedId));
        const existingTagIds = existingTags.map(t => t.tagId);

        const toAdd = tagsIds.filter((id: string) => !existingTagIds.includes(id));
        const toRemove = existingTagIds.filter(id => !tagsIds.includes(id));

        if (toRemove.length > 0) {
          await tx.delete(postsToTags).where(and(eq(postsToTags.postId, savedId), inArray(postsToTags.tagId, toRemove)));
        }

        if (toAdd.length > 0) {
          await tx.insert(postsToTags).values(
            toAdd.map((tagId: string) => ({
              postId: savedId,
              tagId
            }))
          );
        }
      }

      if (postMediaItems) {
         await tx.delete(postsToMedia).where(eq(postsToMedia.postId, savedId));
         if (postMediaItems.length > 0) {
           await tx.insert(postsToMedia).values(
             postMediaItems.map((m: any) => ({
               postId: savedId,
               mediaId: m.mediaId,
               order: m.order,
               position: m.position
             }))
           );
         }
      }
    });

    const populated = await this.getById(savedId);
    if (!populated) throw new Error("Failed to load saved post");
    return populated;
  }
}

export const postRepository = new PostRepository();

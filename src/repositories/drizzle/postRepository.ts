import { DrizzleBaseRepository } from "./baseRepository";
import { posts, postsToTags, tags, media, postsToMedia } from "./schema";
import { Post, PopulatedPost, PaginationOptions, PopulatedPostMedia } from "@/types";
import { drizzleDatabase } from "./database";
import { eq, and, or, sql, inArray, desc } from "drizzle-orm";
import { IPostRepository, QueryOptions } from "../interfaces";
import { isUUID } from "@/utils/uuid";

type PostRecord = typeof posts.$inferSelect & {
  postsToTags?: { tag: typeof tags.$inferSelect }[];
  postsToMedia?: (typeof postsToMedia.$inferSelect & {
    media: typeof media.$inferSelect;
  })[];
};

export class PostRepository extends DrizzleBaseRepository<Post, PopulatedPost, QueryOptions> implements IPostRepository {
  constructor() {
    super(posts);
  }

  private mapToPopulated(record: PostRecord): PopulatedPost {
    if (!record) return record as unknown as PopulatedPost;
    const tagsList = record.postsToTags?.map((pt) => pt.tag) || [];

    const mediaList: PopulatedPostMedia[] = record.postsToMedia?.map((pm) => ({
      id: pm.media.id,
      order: pm.order,
      mediaId: pm.media.id,
      position: pm.position ?? undefined,
      media: pm.media as unknown as PopulatedPostMedia["media"]
    })) || [];

    mediaList.sort((a, b) => a.order - b.order);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately excluding these relations from restRecord, not using them.
    const { postsToTags, postsToMedia, ...restRecord } = record;

    return {
      ...restRecord,
      media: mediaList,
      tags: tagsList,
      tagsIds: tagsList.map((t) => t.id),
    } as unknown as PopulatedPost;
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

  async populate(item: { id: string } & Record<string, unknown>): Promise<PopulatedPost> {
    if (!item) return item as unknown as PopulatedPost;
    const results = await this.getById(item.id);
    if (!results) return item as unknown as PopulatedPost;
    return results;
  }

  override async getAll(options?: QueryOptions): Promise<PopulatedPost[]> {
    if (options && Object.keys(options).some(k => !['page', 'limit', 'offset'].includes(k))) {
      return this.getByQuery(options, options);
    }

    const db = drizzleDatabase.getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle's relational query-builder config type is generic over the schema/fields pair and can't be named without re-deriving that generic here; built up dynamically below.
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
    if (!isUUID(id)) return undefined;
    const record = await drizzleDatabase.getDb().query.posts.findFirst({
      where: eq(posts.id, id),
      with: this.getWithRelations()
    });
    return record ? this.mapToPopulated(record) : undefined;
  }

  override async getByIds(ids: string[]): Promise<PopulatedPost[]> {
    const validIds = ids.filter(isUUID);
    if (!validIds.length) return [];
    const records = await drizzleDatabase.getDb().query.posts.findMany({
      where: inArray(posts.id, validIds),
      with: this.getWithRelations()
    });
    return records.map(this.mapToPopulated.bind(this));
  }

  async countByCategory(categoryId: string): Promise<number> {
    if (!isUUID(categoryId)) return 0;
    const [{ count }] = await drizzleDatabase.getDb()
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.categoryId, categoryId));
    return Number(count);
  }

  async countByPoster(mediaId: string): Promise<number> {
    if (!isUUID(mediaId)) return 0;
    const [{ count }] = await drizzleDatabase.getDb()
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.posterId, mediaId));
    return Number(count);
  }

  async countGalleryUsage(mediaId: string): Promise<number> {
    if (!isUUID(mediaId)) return 0;
    const [{ count }] = await drizzleDatabase.getDb()
      .select({ count: sql<number>`count(*)` })
      .from(postsToMedia)
      .where(eq(postsToMedia.mediaId, mediaId));
    return Number(count);
  }

  async getBySlug(slug: string): Promise<PopulatedPost | undefined> {
    const record = await drizzleDatabase.getDb().query.posts.findFirst({
      where: eq(posts.slug, slug),
      with: this.getWithRelations()
    });
    return record ? this.mapToPopulated(record) : undefined;
  }

  async getByQuery(query: QueryOptions, options?: PaginationOptions): Promise<PopulatedPost[]> {
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
      // Escape ILIKE wildcards in the user's input so a literal "%" or "_" is matched
      // literally instead of acting as a pattern; "\" is Postgres's default LIKE escape char.
      const escapedSearch = query.search.replace(/[\\%_]/g, "\\$&");
      const pattern = `%${escapedSearch}%`;
      conditions.push(
        or(
          sql`${posts.title}::text ILIKE ${pattern}`,
          sql`${posts.description}::text ILIKE ${pattern}`
        )!
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same generic Drizzle relational query-builder config as in getAll above.
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

    const { tagsIds, media: postMediaItems, ...postData } = item;

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
             postMediaItems.map((m) => ({
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

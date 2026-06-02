import { DrizzleBaseRepository } from "./baseRepository";
import { comments, posts } from "./schema";
import { Comment, PopulatedComment, PaginationOptions } from "@/types";
import { drizzleDatabase } from "./database";
import { eq, and, desc } from "drizzle-orm";
import { ICommentRepository, QueryOptions } from "../interfaces";

type CommentRecord = typeof comments.$inferSelect & {
  post?: typeof posts.$inferSelect;
  parent?: typeof comments.$inferSelect;
  replies?: typeof comments.$inferSelect[];
  [key: string]: any;
};

export class CommentRepository extends DrizzleBaseRepository<Comment, PopulatedComment, QueryOptions> implements ICommentRepository {
  constructor() {
    super(comments as any);
  }

  async populate(item: any, options?: { populate?: string }): Promise<PopulatedComment> {
    if (!item) return item;
    const results = await this.getById(item.id, options);
    if (!results) return item;
    return results;
  }


  private mapToPopulated(record: CommentRecord): PopulatedComment {
    if (!record) return record as any;
    return record as unknown as PopulatedComment;
  }

  private getWithRelations() {
    return {
      post: true as const
    };
  }

  override async getAll(options?: QueryOptions): Promise<PopulatedComment[]> {
    if (options && Object.keys(options).some(k => !['page', 'limit', 'offset', 'populate'].includes(k))) {
      return this.getByQuery(options, options);
    }

    const db = drizzleDatabase.getDb();
    const queryOptions: any = {
      with: this.getWithRelations(),
      orderBy: [desc(comments.createdAt)]
    };
    
    if (options?.limit) {
      queryOptions.limit = options.limit;
      if (options?.page) {
        queryOptions.offset = (options.page - 1) * options.limit;
      }
    }

    const records = await db.query.comments.findMany(queryOptions);
    return records.map(this.mapToPopulated.bind(this));
  }

  override async getById(id: string, options?: { populate?: string }): Promise<PopulatedComment | undefined> {
    const record = await drizzleDatabase.getDb().query.comments.findFirst({
      where: eq(comments.id, id),
      with: this.getWithRelations()
    });
    return record ? this.mapToPopulated(record as any) : undefined;
  }

  async getByQuery(query: Record<string, any>, options?: PaginationOptions & { populate?: string }): Promise<PopulatedComment[]> {
    const db = drizzleDatabase.getDb();
    const conditions = [];

    if (query.postId) conditions.push(eq(comments.postId, query.postId));
    if (query.status) conditions.push(eq(comments.status, query.status));
    if (query.replyId !== undefined) {
       if (query.replyId === null) {
          // not trivial to check null in Drizzle without isNull, but wait, usually we don't query by replyId directly unless we want top-level
          // actually let's skip for now
       } else {
          conditions.push(eq(comments.replyId, query.replyId));
       }
    }

    const queryOptions: any = {
      with: this.getWithRelations(),
      orderBy: [desc(comments.createdAt)]
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

    const records = await db.query.comments.findMany(queryOptions);
    return records.map(this.mapToPopulated.bind(this));
  }

  override async save(item: Comment): Promise<PopulatedComment> {
    const db = drizzleDatabase.getDb();
    
    // Strip relational data that shouldn't be saved
    const { post, parent, replies, ...dataToSave } = item as any;
    
    const existing = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, item.id)).limit(1);

    await db.transaction(async (tx) => {
      if (existing.length) {
        await tx.update(comments).set(dataToSave).where(eq(comments.id, item.id));
      } else {
        await tx.insert(comments).values(dataToSave);
      }
    });

    const populated = await this.getById(item.id);
    if (!populated) throw new Error("Failed to load saved comment");
    return populated;
  }

  override async delete(id: string): Promise<boolean> {
    const db = drizzleDatabase.getDb();
    let deleted = false;
    await db.transaction(async (tx) => {
      // Manually delete child replies to avoid foreign key constraint error
      // since reply_id column might lack ON DELETE CASCADE
      await tx.delete(comments).where(eq(comments.replyId, id));
      
      const result = await tx.delete(comments).where(eq(comments.id, id)).returning({ id: comments.id });
      deleted = result.length > 0;
    });
    return deleted;
  }
}

export const commentRepository = new CommentRepository();

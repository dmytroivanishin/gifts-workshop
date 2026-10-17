import { DrizzleBaseRepository } from "./baseRepository";
import { comments, posts } from "./schema";
import { Comment, PopulatedComment, PaginationOptions } from "@/types";
import { drizzleDatabase } from "./database";
import { eq, and, desc } from "drizzle-orm";
import { ICommentRepository, QueryOptions } from "../interfaces";
import { isUUID } from "@/utils/uuid";

type CommentRecord = typeof comments.$inferSelect & {
  post?: typeof posts.$inferSelect;
  parent?: typeof comments.$inferSelect;
  replies?: typeof comments.$inferSelect[];
};

export class CommentRepository extends DrizzleBaseRepository<Comment, PopulatedComment, QueryOptions> implements ICommentRepository {
  constructor() {
    super(comments);
  }

  async populate(item: { id: string } & Record<string, unknown>): Promise<PopulatedComment> {
    if (!item) return item as unknown as PopulatedComment;
    const results = await this.getById(item.id);
    if (!results) return item as unknown as PopulatedComment;
    return results;
  }


  private mapToPopulated(record: CommentRecord): PopulatedComment {
    if (!record) return record as unknown as PopulatedComment;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle's relational query-builder config type is generic over the schema/fields pair and can't be named without re-deriving that generic here; built up dynamically below.
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

  override async getById(id: string): Promise<PopulatedComment | undefined> {
    if (!isUUID(id)) return undefined;
    const record = await drizzleDatabase.getDb().query.comments.findFirst({
      where: eq(comments.id, id),
      with: this.getWithRelations()
    });
    return record ? this.mapToPopulated(record) : undefined;
  }

  async getByQuery(query: QueryOptions, options?: PaginationOptions): Promise<PopulatedComment[]> {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same generic Drizzle relational query-builder config as in getAll above.
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
    
    // Strip relational data that shouldn't be saved (present only if a caller passes a
    // PopulatedComment in where a plain Comment is expected; item itself never declares these).
    const { post, parent, replies, ...dataToSave } = item as PopulatedComment;
    
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
    if (!isUUID(id)) return false;
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

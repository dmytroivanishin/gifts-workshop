import { ICommentRepository, QueryOptions } from "@/repositories/interfaces";
import { ICommentService } from "./interfaces";
import { Comment, PaginatedResult } from "@/types";
import { randomUUID } from "crypto";
import { paginate } from "./pagination";

export class CommentService implements ICommentService {
  constructor(private commentRepo: ICommentRepository) {}

  async getFilteredComments(filters?: QueryOptions): Promise<PaginatedResult<Comment>> {
    const dbOptions: QueryOptions = {
      postId: filters?.postId,
      status: filters?.status,
    };

    if (filters?.page || filters?.limit) {
      const page = filters.page || 1;
      const limit = filters.limit || 20;

      const comments = await this.commentRepo.getByQuery(dbOptions, {
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
      });

      return paginate(comments as any, { page, limit });
    }

    const comments = await this.commentRepo.getByQuery(dbOptions);
    return {
      data: comments as any,
      meta: {
        page: 1,
        nextPage: null,
        prevPage: null,
        totalItems: comments.length,
      }
    };
  }

  async getCommentById(id: string, options?: { populate?: string }): Promise<Comment | undefined> {
    return this.commentRepo.getById(id, options);
  }

  async createComment(body: any): Promise<Comment> {
    const id = randomUUID();
    
    const newComment: Comment = {
      id,
      postId: body.postId,
      name: body.name,
      text: body.text,
      status: "Review",
      replyId: body.replyId,
      createdAt: new Date(),
    };

    return this.commentRepo.save(newComment);
  }

  async updateCommentStatus(id: string, status: "Review" | "Approved" | "Rejected"): Promise<Comment | undefined> {
    const existing = await this.commentRepo.getById(id);
    if (!existing) return undefined;

    const updatedComment: Comment = {
      ...existing,
      status
    };

    return this.commentRepo.save(updatedComment);
  }

  async replyToComment(id: string, body: any): Promise<Comment> {
    const existing = await this.commentRepo.getById(id);
    if (!existing) throw new Error("Parent comment not found");

    const replyId = randomUUID();
    const replyComment: Comment = {
      id: replyId,
      postId: existing.postId, // same post
      name: body.name || "Admin", // default to Admin if not provided
      text: body.text,
      status: "Approved", // Admin replies are automatically approved
      replyId: id, // self-referential to parent
      createdAt: new Date(),
    };

    return this.commentRepo.save(replyComment);
  }

  async deleteComment(id: string): Promise<boolean> {
    return this.commentRepo.delete(id);
  }
}

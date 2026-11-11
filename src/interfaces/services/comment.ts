import type { Comment, PaginatedResult } from "@/types";
import type { QueryOptions } from "../query";

export interface ICommentService {
  getFilteredComments(filters?: QueryOptions): Promise<PaginatedResult<Comment>>;
  getCommentById(id: string): Promise<Comment | undefined>;
  createComment(body: { postId: string; name: string; text: string; replyId?: string | null }): Promise<Comment>;
  updateCommentStatus(id: string, status: "Review" | "Approved" | "Rejected"): Promise<Comment | undefined>;
  replyToComment(id: string, body: { name?: string; text: string }): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;
}

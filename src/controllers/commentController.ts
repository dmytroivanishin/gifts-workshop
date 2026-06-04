import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ICommentService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest } from "@/lib/validateRequest";
import { commentSchema } from "@/common/validation/schemas";
import { getPaginationParams } from "@/utils/paginationUtils";

export class CommentController {
  constructor(private commentService: ICommentService) {}

  async getComments(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit } = getPaginationParams(request);
      const status = searchParams.get("status") || undefined;
      const postId = searchParams.get("postId") || undefined;

      const result = await this.commentService.getFilteredComments({ page, limit, status, postId });
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async createComment(request: Request, injectedPostId?: string) {
    try {
      const rawBody = await request.json();
      if (injectedPostId) {
        rawBody.postId = injectedPostId;
      }
      const body = await validateRequest(commentSchema, rawBody);
      const comment = await this.commentService.createComment(body);
      return sendSuccess(comment);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async updateCommentStatus(request: Request, id: string) {
    try {
      const rawBody = await request.json();
      const statusSchema = z.object({
        status: z.enum(["Review", "Approved", "Rejected"])
      });
      const body = await validateRequest(statusSchema, rawBody);
      const comment = await this.commentService.updateCommentStatus(id, body.status);
      if (!comment) {
         throw new NotFoundError("Comment not found");
      }
      return sendSuccess(comment);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async replyToComment(request: Request, id: string) {
    try {
      const rawBody = await request.json();
      const replySchema = z.object({
        text: z.string().min(1, "error_required_field").max(2000, "error_text_too_long")
      });
      const body = await validateRequest(replySchema, rawBody);
      const comment = await this.commentService.replyToComment(id, body);
      return sendSuccess(comment);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteComment(request: Request, id: string) {
    try {
      await this.commentService.deleteComment(id);
      return sendSuccess(null);
    } catch (error: any) {
      return sendError(error);
    }
  }
}

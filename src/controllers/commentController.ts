import { z } from "zod";
import { sendSuccess, withErrorHandling } from "@/utils/apiResponse";
import { ICommentService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { commentSchema } from "@/common/validation/schemas";
import { getPaginationParams } from "@/utils/paginationUtils";

export class CommentController {
  constructor(private commentService: ICommentService) {}

  getComments = withErrorHandling(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = getPaginationParams(request);
    const status = searchParams.get("status") || undefined;
    const postId = searchParams.get("postId") || undefined;

    const result = await this.commentService.getFilteredComments({ page, limit, status, postId });
    return sendSuccess(result.data, result.meta);
  });

  createComment = withErrorHandling(async (request: Request, injectedPostId?: string) => {
    const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
    if (injectedPostId) {
      rawBody.postId = injectedPostId;
    }
    const body = await validateRequest(commentSchema, rawBody);
    const comment = await this.commentService.createComment(body);
    return sendSuccess(comment);
  });

  updateCommentStatus = withErrorHandling(async (request: Request, id: string) => {
    const rawBody = await parseJsonBody(request);
    const statusSchema = z.object({
      status: z.enum(["Review", "Approved", "Rejected"])
    });
    const body = await validateRequest(statusSchema, rawBody);
    const comment = await this.commentService.updateCommentStatus(id, body.status);
    if (!comment) {
       throw new NotFoundError("Comment not found");
    }
    return sendSuccess(comment);
  });

  replyToComment = withErrorHandling(async (request: Request, id: string) => {
    const rawBody = await parseJsonBody(request);
    const replySchema = z.object({
      text: z.string().min(1, "error_required_field").max(2000, "error_text_too_long")
    });
    const body = await validateRequest(replySchema, rawBody);
    const comment = await this.commentService.replyToComment(id, body);
    return sendSuccess(comment);
  });

  deleteComment = withErrorHandling(async (request: Request, id: string) => {
    await this.commentService.deleteComment(id);
    return sendSuccess(null);
  });
}

import { commentController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const POST = withAdminAuth(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    return commentController.replyToComment(request, params.id);
  }
);

import { commentController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const DELETE = withAdminAuth(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    return commentController.deleteComment(request, params.id);
  }
);

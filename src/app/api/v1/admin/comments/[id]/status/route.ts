import { commentController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const PATCH = withAdminAuth(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const params = await context.params;
    return commentController.updateCommentStatus(request, params.id);
  }
);

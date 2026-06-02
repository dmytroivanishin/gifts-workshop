import { commentController } from "@/lib/container";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return commentController.updateCommentStatus(request, params.id);
}

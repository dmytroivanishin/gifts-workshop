import { commentController } from "@/modules/core/container";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return commentController.deleteComment(request, params.id);
}

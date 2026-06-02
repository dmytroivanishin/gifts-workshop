import { commentController } from "@/lib/container";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  return commentController.replyToComment(request, params.id);
}

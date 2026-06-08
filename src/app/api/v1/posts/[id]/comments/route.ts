import { commentController } from "@/modules/core/container";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  // Add postId to search params to let controller filter
  const params = await context.params;
  const url = new URL(request.url);
  url.searchParams.set("postId", params.id);
  url.searchParams.set("status", "Approved"); // Only public sees approved
  const modifiedRequest = new Request(url.toString(), request);
  return commentController.getComments(modifiedRequest);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // Controller expects postId. We can inject it as second argument.
  const params = await context.params;
  return commentController.createComment(request, params.id);
}

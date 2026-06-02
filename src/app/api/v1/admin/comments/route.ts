import { commentController } from "@/lib/container";

export async function GET(request: Request) {
  return commentController.getComments(request);
}

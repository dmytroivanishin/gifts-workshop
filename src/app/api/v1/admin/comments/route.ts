import { commentController } from "@/modules/core/container";

export async function GET(request: Request) {
  return commentController.getComments(request);
}

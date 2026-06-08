import { postController } from "@/modules/core/container";

export async function GET(request: Request) {
  return postController.getPosts(request);
}

export async function POST(request: Request) {
  return postController.createPost(request);
}

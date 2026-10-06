import { postController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(request: Request) {
  return postController.getPosts(request);
}

export const POST = withAdminAuth((request: Request) =>
  postController.createPost(request)
);

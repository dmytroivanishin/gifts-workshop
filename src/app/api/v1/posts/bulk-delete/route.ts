import { postController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const POST = withAdminAuth((request: Request) =>
  postController.bulkDeletePosts(request)
);

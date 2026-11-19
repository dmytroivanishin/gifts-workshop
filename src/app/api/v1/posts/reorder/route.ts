import { postController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const PUT = withAdminAuth((request: Request) => postController.reorderPosts(request));

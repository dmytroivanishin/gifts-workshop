import { postController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const POST = withAdminAuth(() => postController.createPlaceholderPost());

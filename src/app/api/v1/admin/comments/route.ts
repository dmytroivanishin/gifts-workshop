import { commentController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const GET = withAdminAuth((request: Request) => commentController.getComments(request));

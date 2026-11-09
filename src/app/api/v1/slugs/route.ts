import { slugController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const POST = withAdminAuth((request: Request) =>
  slugController.generateSlug(request)
);

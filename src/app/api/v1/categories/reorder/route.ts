import { categoryController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const PUT = withAdminAuth((request: Request) =>
  categoryController.reorderCategories(request)
);

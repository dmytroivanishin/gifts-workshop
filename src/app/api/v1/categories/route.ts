import { categoryController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(request: Request) {
  return categoryController.getCategories(request);
}

export const POST = withAdminAuth((request: Request) =>
  categoryController.saveCategory(request)
);

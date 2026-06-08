import { categoryController } from "@/modules/core/container";

export async function PUT(request: Request) {
  return categoryController.reorderCategories(request);
}

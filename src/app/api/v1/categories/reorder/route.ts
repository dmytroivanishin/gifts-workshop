import { categoryController } from "@/lib/container";

export async function PUT(request: Request) {
  return categoryController.reorderCategories(request);
}

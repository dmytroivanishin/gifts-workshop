import { categoryController } from "@/lib/container";

export async function GET(request: Request) {
  return categoryController.getCategories(request);
}

export async function POST(request: Request) {
  return categoryController.saveCategory(request);
}

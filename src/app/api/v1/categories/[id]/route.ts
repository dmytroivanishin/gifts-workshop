import { categoryController } from "@/lib/container";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const category = await categoryController.getCategories(request); // Controller currently lists all or we can fetch directly
    return category;
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to get category" }), { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return categoryController.saveCategory(request);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return categoryController.deleteCategory(request, id);
}

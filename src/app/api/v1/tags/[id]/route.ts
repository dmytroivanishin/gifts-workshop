import { tagController } from "@/lib/container";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return tagController.saveTag(request);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return tagController.deleteTag(request, id);
}

import { mediaController } from "@/lib/container";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return mediaController.deleteMedia(request, id);
}

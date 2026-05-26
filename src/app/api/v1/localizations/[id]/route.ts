import { localizationController } from "@/lib/container";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return localizationController.deleteLocalization(request, id);
}

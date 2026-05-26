import { userController } from "@/lib/container";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return userController.deleteUser(request, id);
}

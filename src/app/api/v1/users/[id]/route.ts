import { userController } from "@/modules/core/container";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return userController.getUserById(request, id);
}

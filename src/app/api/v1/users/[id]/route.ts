import { userController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const GET = withAdminAuth(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    return userController.getUserById(request, id);
  }
);

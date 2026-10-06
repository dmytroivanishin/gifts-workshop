import { tagController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return tagController.getTagById(request, id);
}

export const PUT = withAdminAuth(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    return tagController.saveTag(request, id);
  }
);

export const DELETE = withAdminAuth(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    return tagController.deleteTag(request, id);
  }
);

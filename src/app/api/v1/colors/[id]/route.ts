import { colorController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return colorController.getColorById(request, id);
}

export const PUT = withAdminAuth(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    return colorController.saveColor(request, id);
  }
);

export const DELETE = withAdminAuth(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    return colorController.deleteColor(request, id);
  }
);

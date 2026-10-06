import { systemTextController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return systemTextController.getSystemTextById(request, resolvedParams.id);
}

export const PATCH = withAdminAuth(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const resolvedParams = await params;
    return systemTextController.saveSystemText(request, resolvedParams.id);
  }
);

export const DELETE = withAdminAuth(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const resolvedParams = await params;
    return systemTextController.deleteSystemText(request, resolvedParams.id);
  }
);

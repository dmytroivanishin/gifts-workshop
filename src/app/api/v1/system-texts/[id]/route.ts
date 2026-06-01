import { systemTextController } from "@/lib/container";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return systemTextController.getSystemTextById(request, resolvedParams.id);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return systemTextController.saveSystemText(request, resolvedParams.id);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return systemTextController.deleteSystemText(request, resolvedParams.id);
}

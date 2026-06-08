import { languageController } from "@/modules/core/container";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return languageController.getLanguageById(request, resolvedParams.id);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return languageController.saveLanguage(request, resolvedParams.id);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return languageController.deleteLanguage(request, resolvedParams.id);
}

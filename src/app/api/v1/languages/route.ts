import { languageController } from "@/modules/core/container";

export async function GET(request: Request) {
  return languageController.getLanguages(request);
}

export async function POST(request: Request) {
  return languageController.saveLanguage(request);
}

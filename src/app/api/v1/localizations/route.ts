import { localizationController } from "@/lib/container";

export async function GET(request: Request) {
  return localizationController.getLocalizations(request);
}

export async function POST(request: Request) {
  return localizationController.saveLocalization(request);
}

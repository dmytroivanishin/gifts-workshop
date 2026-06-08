import { systemTextController } from "@/modules/core/container";

export async function GET(request: Request) {
  return systemTextController.getSystemTexts(request);
}

export async function POST(request: Request) {
  return systemTextController.saveSystemText(request);
}

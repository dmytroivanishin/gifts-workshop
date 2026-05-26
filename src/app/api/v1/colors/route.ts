import { colorController } from "@/lib/container";

export async function GET(request: Request) {
  return colorController.getColors(request);
}

export async function POST(request: Request) {
  return colorController.saveColor(request);
}

import { mediaController } from "@/modules/core/container";

export async function GET(request: Request) {
  return mediaController.getMedia(request);
}

export async function POST(request: Request) {
  return mediaController.saveMedia(request);
}

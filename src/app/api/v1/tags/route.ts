import { tagController } from "@/modules/core/container";

export async function GET(request: Request) {
  return tagController.getTags(request);
}

export async function POST(request: Request) {
  return tagController.saveTag(request);
}

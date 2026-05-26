import { tagController } from "@/lib/container";

export async function GET(request: Request) {
  return tagController.getTags(request);
}

export async function POST(request: Request) {
  return tagController.saveTag(request);
}

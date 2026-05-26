import { slugController } from "@/lib/container";

export async function GET(request: Request) {
  return slugController.getSlugByName(request);
}

export async function POST(request: Request) {
  return slugController.generateSlug(request);
}

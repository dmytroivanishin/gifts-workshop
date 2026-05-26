import { collectionController } from "@/lib/container";

export async function GET(request: Request) {
  return collectionController.getCollections(request);
}

export async function POST(request: Request) {
  return collectionController.saveCollection(request);
}

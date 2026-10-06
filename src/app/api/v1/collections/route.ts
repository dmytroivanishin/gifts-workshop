import { collectionController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(request: Request) {
  return collectionController.getCollections(request);
}

export const POST = withAdminAuth((request: Request) =>
  collectionController.saveCollection(request)
);

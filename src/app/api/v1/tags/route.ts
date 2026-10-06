import { tagController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(request: Request) {
  return tagController.getTags(request);
}

export const POST = withAdminAuth((request: Request) =>
  tagController.saveTag(request)
);

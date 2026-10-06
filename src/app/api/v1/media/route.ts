import { mediaController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(request: Request) {
  return mediaController.getMedia(request);
}

export const POST = withAdminAuth((request: Request) =>
  mediaController.saveMedia(request)
);

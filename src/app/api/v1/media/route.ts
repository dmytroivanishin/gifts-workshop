import { mediaController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const GET = withAdminAuth((request: Request) =>
  mediaController.getMedia(request)
);

export const POST = withAdminAuth((request: Request) =>
  mediaController.saveMedia(request)
);

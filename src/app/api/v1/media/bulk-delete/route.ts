import { mediaController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const POST = withAdminAuth((request: Request) =>
  mediaController.bulkDeleteMedia(request)
);

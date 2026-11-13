import { mediaController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const GET = withAdminAuth((request: Request) =>
  mediaController.findByContentHash(request)
);

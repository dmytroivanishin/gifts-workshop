import { userController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export const GET = withAdminAuth(() => userController.getUsers());

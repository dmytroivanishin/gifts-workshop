import { systemTextController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(request: Request) {
  return systemTextController.getSystemTexts(request);
}

export const POST = withAdminAuth((request: Request) =>
  systemTextController.saveSystemText(request)
);

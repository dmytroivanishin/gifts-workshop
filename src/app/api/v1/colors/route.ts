import { colorController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET(request: Request) {
  return colorController.getColors(request);
}

export const POST = withAdminAuth((request: Request) =>
  colorController.saveColor(request)
);

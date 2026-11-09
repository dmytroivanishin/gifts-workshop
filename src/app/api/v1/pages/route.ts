import { pageController } from "@/modules/core/container";
import { withAdminAuth } from "@/utils/withAdminAuth";

export async function GET() {
  return pageController.getPages();
}

export const POST = withAdminAuth((request: Request) =>
  pageController.savePage(request)
);

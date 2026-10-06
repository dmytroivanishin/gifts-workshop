import { sendSuccess, sendError } from "@/utils/apiResponse";
import { postService } from "@/modules/core/container";
import { resolveStatusFilter } from "@/utils/postVisibility";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const status = await resolveStatusFilter(undefined);
    const result = await postService.getFilteredPosts({ collection: id, status });
    return sendSuccess(result.data, result.meta);
  } catch (error: any) {
    return sendError(error);
  }
}

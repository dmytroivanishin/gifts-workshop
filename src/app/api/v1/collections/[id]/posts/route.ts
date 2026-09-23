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
    const posts = await postService.getFilteredPosts({ collection: id, status });
    return sendSuccess(posts, {
      page: 1,
      nextPage: null,
      prevPage: null,
      totalItems: posts.length,
    });
  } catch (error: any) {
    return sendError(error);
  }
}

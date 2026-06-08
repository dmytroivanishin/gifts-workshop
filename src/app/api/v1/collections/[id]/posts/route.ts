import { sendSuccess, sendError } from "@/utils/apiResponse";
import { postService } from "@/modules/core/container";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const posts = await postService.getFilteredPosts({ collection: id });
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

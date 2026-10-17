import { sendSuccess, sendError, CACHE_SECONDS } from "@/utils/apiResponse";
import { postService } from "@/modules/core/container";
import { resolveStatusFilter } from "@/utils/postVisibility";
import { isAdminRequest } from "@/utils/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const status = await resolveStatusFilter(undefined);
    const result = await postService.getFilteredPosts({ collection: id, status });
    // Same rule as GET /posts: an admin sees every status, so only the anonymous-shaped
    // response (Published only) is safe for a shared cache.
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.posts;
    return sendSuccess(result.data, result.meta, cacheSeconds);
  } catch (error: unknown) {
    return sendError(error);
  }
}

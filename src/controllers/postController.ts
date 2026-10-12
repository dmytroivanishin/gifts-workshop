import { z } from "zod";
import { sendSuccess, CACHE_SECONDS, withErrorHandling } from "@/utils/apiResponse";
import { IPostService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { postSchema } from "@/common/validation/schemas";
import { resolveId } from "@/utils/idResolver";
import { getUserId, isAdminRequest } from "@/utils/auth";
import { getPaginationParams } from "@/utils/paginationUtils";
import { isUUID } from "@/utils/uuid";
import { resolveStatusFilter, visibleToViewer } from "@/utils/postVisibility";
export class PostController {
  constructor(private postService: IPostService) {}

  getPosts = withErrorHandling(async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const tag = searchParams.get("tag") || undefined;
    const collection = searchParams.get("collection") || undefined;
    const inStock = searchParams.get("inStock") === "true" ? true : undefined;
    const status = await resolveStatusFilter(searchParams.get("status") || undefined);
    // Posts are the heaviest list (full relations), so a request without paging gets one page instead of everything
    const { page, limit } = getPaginationParams(request, 1, 20);

    const result = await this.postService.getFilteredPosts({ search, category, tag, collection, inStock, status, page, limit });

    // An admin's response can include Draft/Archived posts, so only the anonymous-shaped
    // response is safe for a shared cache to store under this URL.
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.posts;
    return sendSuccess(result.data, result.meta, cacheSeconds);
  });

  getPostById = withErrorHandling(async (request: Request, id: string) => {
    let post;
    if (isUUID(id)) {
      post = await this.postService.getPostById(id);
    } else {
      post = await this.postService.getPostBySlug(id);
    }

    // 404 rather than 401/403 so the response does not reveal that an unpublished post exists
    post = await visibleToViewer(post);

    if (!post) {
      throw new NotFoundError("Post not found");
    }
    // Same reasoning as getPosts above: an admin can still see Draft/Archived posts here.
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.posts;
    return sendSuccess(post, undefined, cacheSeconds);
  });

  createPost = withErrorHandling(async (request: Request) => {
    const rawBody: any = await parseJsonBody(request);
    const body = await validateRequest(postSchema, rawBody);
    const userId = await getUserId();
    const post = await this.postService.createPost({ ...body, userId } as any);
    return sendSuccess(post);
  });

  updatePost = withErrorHandling(async (request: Request, id: string) => {
    const rawBody: any = await parseJsonBody(request);
    const resolvedId = await resolveId(id, (slug) => this.postService.getPostBySlug(slug));
    const body = await validateRequest(postSchema, rawBody);
    const userId = await getUserId();
    const post = await this.postService.updatePost(resolvedId, { ...body, userId } as any);
    if (!post) {
      throw new NotFoundError("Post not found");
    }
    return sendSuccess(post);
  });

  deletePost = withErrorHandling(async (request: Request, id: string) => {
    const success = await this.postService.deletePost(id);
    if (!success) {
      throw new NotFoundError("Post not found");
    }
    return sendSuccess({ success: true });
  });
}

import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { IPostService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest } from "@/lib/validateRequest";
import { postSchema } from "@/common/validation/schemas";
import { resolveId } from "@/utils/idResolver";
import { getUserId } from "@/lib/authUtils";
import { getPaginationParams } from "@/utils/paginationUtils";

export class PostController {
  constructor(private postService: IPostService) {}

  async getPosts(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search") || undefined;
      const category = searchParams.get("category") || undefined;
      const tag = searchParams.get("tag") || undefined;
      const collection = searchParams.get("collection") || undefined;
      const inStock = searchParams.get("inStock") === "true" ? true : undefined;
      const status = searchParams.get("status") || undefined;
      const populate = searchParams.get("populate") || undefined;
      
      const { page, limit } = getPaginationParams(request);

      const result = await this.postService.getFilteredPosts({ search, category, tag, collection, inStock, status, page, limit, populate });

      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getPostById(request: Request, id: string) {
    try {
      const { searchParams } = new URL(request.url);
      const populate = searchParams.get("populate") || undefined;
      const post = await this.postService.getPostById(id, { populate });
      if (!post) {
        throw new NotFoundError("Post not found");
      }
      return sendSuccess(post);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async createPost(request: Request) {
    try {
      const rawBody = await request.json();
      const body = await validateRequest(postSchema, rawBody);
      const userId = await getUserId();
      const post = await this.postService.createPost({ ...body, userId } as any);
      return sendSuccess(post);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async updatePost(request: Request, id: string) {
    try {
      const rawBody = await request.json();
      const resolvedId = await resolveId(id, (slug) => this.postService.getPostBySlug(slug));
      const body = await validateRequest(postSchema, rawBody);
      const userId = await getUserId();
      const post = await this.postService.updatePost(resolvedId, { ...body, userId } as any);
      if (!post) {
        throw new NotFoundError("Post not found");
      }
      return sendSuccess(post);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deletePost(request: Request, id: string) {
    try {
      const success = await this.postService.deletePost(id);
      if (!success) {
        throw new NotFoundError("Post not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}

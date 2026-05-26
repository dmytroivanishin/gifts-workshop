import { sendSuccess, sendError } from "@/lib/apiResponse";
import { IPostService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";

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
      
      const pageStr = searchParams.get("page");
      const limitStr = searchParams.get("limit");
      const page = pageStr ? parseInt(pageStr, 10) : undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : undefined;

      const result = await this.postService.getFilteredPosts({ search, category, tag, collectionSlug: collection, inStock, page, limit });

      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getPostById(request: Request, id: string) {
    try {
      const post = await this.postService.getPostById(id);
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
      const body = await request.json();
      const post = await this.postService.createPost(body);
      return sendSuccess(post);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async updatePost(request: Request, id: string) {
    try {
      const body = await request.json();
      const post = await this.postService.updatePost(id, body);
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

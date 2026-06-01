import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ICategoryService } from "@/services/interfaces";
import { ForbiddenError } from "@/common/errors/forbidden";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";
import { validateRequest } from "@/lib/validateRequest";
import { categorySchema } from "@/common/validation/schemas";
import { getUserId } from "@/lib/authUtils";

export class CategoryController {
  constructor(private categoryService: ICategoryService) {}

  async getCategories(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const pageStr = searchParams.get("page");
      const limitStr = searchParams.get("limit");
      const page = pageStr ? parseInt(pageStr, 10) : undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : undefined;
      const populate = searchParams.get("populate") || undefined;

      const result = await this.categoryService.getAllCategories({ page, limit, populate });
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getCategoryById(request: Request, id: string) {
    try {
      const { searchParams } = new URL(request.url);
      const populate = searchParams.get("populate") || undefined;
      const category = await this.categoryService.getCategoryById(id, { populate });
      if (!category) {
        throw new NotFoundError("Category not found");
      }
      return sendSuccess(category);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async saveCategory(request: Request, id?: string) {
    try {
      const rawBody = await request.json();
      if (id) {
        rawBody.id = await resolveId(id, (slug) => this.categoryService.getCategoryBySlug(slug));
      }
      const body = await validateRequest(categorySchema.extend({ id: z.string().uuid().optional() }), rawBody);
      const userId = await getUserId();
      const category = await this.categoryService.saveCategory({ ...body, userId } as any);
      return sendSuccess(category);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteCategory(request: Request, id: string) {
    try {
      const resolvedId = await resolveId(id, (slug) => this.categoryService.getCategoryBySlug(slug));
      await this.categoryService.deleteCategory(resolvedId);
      return sendSuccess(null);
    } catch (error: any) {
      return sendError(error);
    }
  }
}



import { z } from "zod";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { ICategoryService } from "@/services/interfaces";
import { ForbiddenError } from "@/common/errors/forbidden";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";
import { validateRequest } from "@/utils/validateRequest";
import { categorySchema } from "@/common/validation/schemas";
import { getUserId } from "@/utils/auth";
import { getPaginationParams } from "@/utils/paginationUtils";

export class CategoryController {
  constructor(private categoryService: ICategoryService) {}

  async getCategories(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined;
      const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;

      const result = await this.categoryService.getAllCategories({ page, limit });
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getCategoryById(request: Request, id: string) {
    try {
      const { searchParams } = new URL(request.url);
      const category = await this.categoryService.getCategoryById(id);
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

  async reorderCategories(request: Request) {
    try {
      const rawBody = await request.json();
      const items = z.array(z.object({
        id: z.string().uuid(),
        order: z.number().int()
      })).parse(rawBody.items);
      
      const result = await this.categoryService.reorderCategories(items);
      return sendSuccess(result);
    } catch (error: any) {
      return sendError(error);
    }
  }
}



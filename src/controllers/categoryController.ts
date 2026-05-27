import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ICategoryService } from "@/services/interfaces";
import { ForbiddenError } from "@/common/errors/forbidden";

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

  async saveCategory(request: Request) {
    try {
      const body = await request.json();
      const category = await this.categoryService.saveCategory(body);
      const result = await this.categoryService.getAllCategories();
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteCategory(request: Request, id: string) {
    try {
      throw new ForbiddenError("Categories cannot be deleted to preserve database integrity");
    } catch (error: any) {
      return sendError(error);
    }
  }
}

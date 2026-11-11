import { z } from "zod";
import { sendSuccess, CACHE_SECONDS, withErrorHandling } from "@/utils/apiResponse";
import { ICategoryService } from "@/interfaces/services";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { categorySchema } from "@/common/validation/schemas";
import { getUserId, isAdminRequest } from "@/utils/auth";
import { getPaginationParams } from "@/utils/paginationUtils";

export class CategoryController {
  constructor(private categoryService: ICategoryService) {}

  getCategories = withErrorHandling(async (request: Request) => {
    const { page, limit } = getPaginationParams(request);

    const result = await this.categoryService.getAllCategories({ page, limit });
    // An admin's own session must always see its own just-made writes, not a cached response
    // shared with anonymous callers (CP-37).
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(result.data, result.meta, cacheSeconds);
  });

  getCategoryById = withErrorHandling(async (request: Request, id: string) => {
    const category = await this.categoryService.getCategoryById(id);
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(category, undefined, cacheSeconds);
  });

  saveCategory = withErrorHandling(async (request: Request, id?: string) => {
    const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
    if (id) {
      rawBody.id = await resolveId(id, (slug) => this.categoryService.getCategoryBySlug(slug));
    }
    const body = await validateRequest(categorySchema.extend({ id: z.string().uuid().optional() }), rawBody);
    const userId = await getUserId();
    const category = await this.categoryService.saveCategory({ ...body, userId });
    return sendSuccess(category);
  });

  deleteCategory = withErrorHandling(async (request: Request, id: string) => {
    const resolvedId = await resolveId(id, (slug) => this.categoryService.getCategoryBySlug(slug));
    await this.categoryService.deleteCategory(resolvedId);
    return sendSuccess(null);
  });

  reorderCategories = withErrorHandling(async (request: Request) => {
    const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
    const items = await validateRequest(z.array(z.object({
      id: z.string().uuid(),
      order: z.number().int()
    })), rawBody.items);

    const result = await this.categoryService.reorderCategories(items);
    return sendSuccess(result);
  });
}



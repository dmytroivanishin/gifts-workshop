import { z } from "zod";
import { sendSuccess, CACHE_SECONDS, withErrorHandling } from "@/utils/apiResponse";
import { IPageService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { pageSchema } from "@/common/validation/schemas";
import { getUserId, isAdminRequest } from "@/utils/auth";

export class PageController {
  constructor(private pageService: IPageService) {}

  getPages = withErrorHandling(async () => {
    const pages = await this.pageService.getAllPages();
    // Admin sees its own writes at once; anonymous visitors get the (versioned) browser cache.
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(pages, undefined, cacheSeconds);
  });

  getPageById = withErrorHandling(async (request: Request, id: string) => {
    const page = await this.pageService.getPageById(id);
    if (!page) {
      throw new NotFoundError("Page not found");
    }
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(page, undefined, cacheSeconds);
  });

  savePage = withErrorHandling(async (request: Request, id?: string) => {
    const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
    if (id) {
      rawBody.id = await resolveId(id, (slug) => this.pageService.getPageBySlug(slug));
    }
    const body = await validateRequest(pageSchema.extend({ id: z.string().uuid().optional() }), rawBody);
    const userId = await getUserId();
    const page = await this.pageService.savePage({ ...body, userId });
    return sendSuccess(page);
  });

  deletePage = withErrorHandling(async (request: Request, id: string) => {
    const resolvedId = await resolveId(id, (slug) => this.pageService.getPageBySlug(slug));
    const success = await this.pageService.deletePage(resolvedId);
    if (!success) {
      throw new NotFoundError("Page not found");
    }
    return sendSuccess({ success: true });
  });
}

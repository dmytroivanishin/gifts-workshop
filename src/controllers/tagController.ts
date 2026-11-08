import { z } from "zod";
import { sendSuccess, CACHE_SECONDS, withErrorHandling } from "@/utils/apiResponse";
import { ITagService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { tagSchema } from "@/common/validation/schemas";
import { getPaginationParams } from "@/utils/paginationUtils";
import { getUserId, isAdminRequest } from "@/utils/auth";

export class TagController {
  constructor(private tagService: ITagService) {}

  getTags = withErrorHandling(async (request: Request) => {
    const { page, limit } = getPaginationParams(request);
    const search = new URL(request.url).searchParams.get("search") ?? undefined;

    const result = await this.tagService.getAllTags({ page, limit, search });
    // An admin's own session must always see its own just-made writes, not a cached response
    // shared with anonymous callers (CP-37).
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(result.data, result.meta, cacheSeconds);
  });

  getTagById = withErrorHandling(async (request: Request, id: string) => {
    const tag = await this.tagService.getTagById(id);
    if (!tag) {
      throw new NotFoundError("Tag not found");
    }
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(tag, undefined, cacheSeconds);
  });

  saveTag = withErrorHandling(async (request: Request, id?: string) => {
    const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
    if (id) {
      rawBody.id = await resolveId(id, (slug) => this.tagService.getTagBySlug(slug));
    }
    const body = await validateRequest(tagSchema.extend({ id: z.string().uuid().optional() }), rawBody);
    const userId = await getUserId();
    const tag = await this.tagService.saveTag({ ...body, userId });
    return sendSuccess(tag);
  });

  deleteTag = withErrorHandling(async (request: Request, id: string) => {
    const resolvedId = await resolveId(id, (slug) => this.tagService.getTagBySlug(slug));
    const success = await this.tagService.deleteTag(resolvedId);
    if (!success) {
      throw new NotFoundError("Tag not found");
    }
    return sendSuccess({ success: true });
  });
}



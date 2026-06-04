import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ITagService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";
import { validateRequest } from "@/lib/validateRequest";
import { tagSchema } from "@/common/validation/schemas";
import { getPaginationParams } from "@/utils/paginationUtils";

export class TagController {
  constructor(private tagService: ITagService) {}

  async getTags(request: Request) {
    try {
      const { page, limit } = getPaginationParams(request);

      const result = await this.tagService.getAllTags({ page, limit });
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getTagById(request: Request, id: string) {
    try {
      const tag = await this.tagService.getTagById(id);
      if (!tag) {
        throw new NotFoundError("Tag not found");
      }
      return sendSuccess(tag);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async saveTag(request: Request, id?: string) {
    try {
      const rawBody = await request.json();
      if (id) {
        rawBody.id = await resolveId(id, (slug) => this.tagService.getTagBySlug(slug));
      }
      const body = await validateRequest(tagSchema.extend({ id: z.string().uuid().optional() }), rawBody);
      const tag = await this.tagService.saveTag(body as any);
      return sendSuccess(tag);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteTag(request: Request, id: string) {
    try {
      const resolvedId = await resolveId(id, (slug) => this.tagService.getTagBySlug(slug));
      const success = await this.tagService.deleteTag(resolvedId);
      if (!success) {
        throw new NotFoundError("Tag not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}



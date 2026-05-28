import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ITagService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { resolveId } from "@/utils/idResolver";

export class TagController {
  constructor(private tagService: ITagService) {}

  async getTags(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const pageStr = searchParams.get("page");
      const limitStr = searchParams.get("limit");
      const page = pageStr ? parseInt(pageStr, 10) : undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : undefined;

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
      const body = await request.json();
      if (id) {
        body.id = await resolveId(id, (slug) => this.tagService.getTagBySlug(slug));
      }
      const tag = await this.tagService.saveTag(body);
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



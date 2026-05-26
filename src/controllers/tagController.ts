import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ITagService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";

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

  async saveTag(request: Request) {
    try {
      const body = await request.json();
      const tag = await this.tagService.saveTag(body);
      return sendSuccess(tag);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteTag(request: Request, id: string) {
    try {
      const success = await this.tagService.deleteTag(id);
      if (!success) {
        throw new NotFoundError("Tag not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}

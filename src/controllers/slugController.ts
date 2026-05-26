import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ISlugService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { ValidationError } from "@/common/errors/validation";

export class SlugController {
  constructor(private slugService: ISlugService) {}

  async getSlugByName(request: Request) {
    try {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");
      if (!name) {
        throw new ValidationError("Missing 'name' query parameter");
      }
      const slug = await this.slugService.getSlugByName(name);
      if (!slug) {
        throw new NotFoundError("Slug not found");
      }
      return sendSuccess(slug);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async generateSlug(request: Request) {
    try {
      const body = await request.json();
      const { text, entityId, entityType } = body;
      if (!text || !entityId || !entityType) {
        throw new ValidationError("Missing required body fields: text, entityId, entityType");
      }
      const slug = await this.slugService.generateUniqueSlug(text, entityId, entityType);
      return sendSuccess({ slug });
    } catch (error: any) {
      return sendError(error);
    }
  }
}

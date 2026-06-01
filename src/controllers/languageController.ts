import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ILanguageService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest } from "@/lib/validateRequest";

const languageSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(2).max(255),
  isActive: z.boolean().optional(),
});

export class LanguageController {
  constructor(private languageService: ILanguageService) {}

  async getLanguages(request: Request) {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);

      const result = await this.languageService.getAllLanguages({ page, limit });
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getLanguageById(request: Request, id: string) {
    try {
      const language = await this.languageService.getLanguageById(id);
      if (!language) {
        throw new NotFoundError("Language not found");
      }
      return sendSuccess(language);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async saveLanguage(request: Request, id?: string) {
    try {
      const rawBody = await request.json();
      const body = await validateRequest(languageSchema.extend({ id: z.string().uuid().optional() }), rawBody);
      if (id) body.id = id;
      
      const language = await this.languageService.saveLanguage(body);
      return sendSuccess(language);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteLanguage(request: Request, id: string) {
    try {
      const success = await this.languageService.deleteLanguage(id);
      if (!success) {
        throw new NotFoundError("Language not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}

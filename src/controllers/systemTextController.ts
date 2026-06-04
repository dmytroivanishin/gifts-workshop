import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ISystemTextService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest } from "@/lib/validateRequest";
import { getPaginationParams } from "@/utils/paginationUtils";

const systemTextSchema = z.object({
  id: z.string().min(1).max(255), // the key
  content: z.record(z.string(), z.string()), // { "ru": "...", "en": "..." }
});

export class SystemTextController {
  constructor(private systemTextService: ISystemTextService) {}

  async getSystemTexts(request: Request) {
    try {
      const { page, limit } = getPaginationParams(request, 1, 100);

      const result = await this.systemTextService.getAllSystemTexts({ page, limit });
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getSystemTextById(request: Request, id: string) {
    try {
      const text = await this.systemTextService.getSystemTextById(id);
      if (!text) {
        throw new NotFoundError("System text not found");
      }
      return sendSuccess(text);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async saveSystemText(request: Request, id?: string) {
    try {
      const rawBody = await request.json();
      if (id) {
        rawBody.id = id;
      }
      const body = await validateRequest(systemTextSchema, rawBody);
      
      const text = await this.systemTextService.saveSystemText(body);
      return sendSuccess(text);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteSystemText(request: Request, id: string) {
    try {
      const success = await this.systemTextService.deleteSystemText(id);
      if (!success) {
        throw new NotFoundError("System text not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}

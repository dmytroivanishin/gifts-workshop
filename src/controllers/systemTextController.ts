import { z } from "zod";
import { sendSuccess, CACHE_SECONDS, withErrorHandling } from "@/utils/apiResponse";
import { ISystemTextService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { getPaginationParams } from "@/utils/paginationUtils";

const systemTextSchema = z.object({
  code: z.string().min(1).max(255), // unique key, e.g. "post_created" — always sent by the client
  content: z.record(z.string(), z.string()), // { "ru": "...", "en": "..." }
  area: z.enum(["public", "admin", "shared"]).optional(),
  // The row's real DB UUID. Never sent by the client itself — saveSystemText() injects it
  // from the :id URL segment below when editing, so the service can tell update from insert.
  id: z.string().optional(),
});

export class SystemTextController {
  constructor(private systemTextService: ISystemTextService) {}

  getSystemTexts = withErrorHandling(async (request: Request) => {
    const { page, limit } = getPaginationParams(request, 1, 100);

    const result = await this.systemTextService.getAllSystemTexts({ page, limit });
    return sendSuccess(result.data, result.meta, CACHE_SECONDS.lookup);
  });

  getSystemTextById = withErrorHandling(async (request: Request, id: string) => {
    const text = await this.systemTextService.getSystemTextById(id);
    if (!text) {
      throw new NotFoundError("System text not found");
    }
    return sendSuccess(text, undefined, CACHE_SECONDS.lookup);
  });

  saveSystemText = withErrorHandling(async (request: Request, id?: string) => {
    const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
    if (id) {
      rawBody.id = id;
    }
    const body = await validateRequest(systemTextSchema, rawBody);

    const text = await this.systemTextService.saveSystemText(body);
    return sendSuccess(text);
  });

  deleteSystemText = withErrorHandling(async (request: Request, id: string) => {
    const success = await this.systemTextService.deleteSystemText(id);
    if (!success) {
      throw new NotFoundError("System text not found");
    }
    return sendSuccess({ success: true });
  });
}

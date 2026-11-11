import { z } from "zod";
import { sendSuccess, CACHE_SECONDS, withErrorHandling } from "@/utils/apiResponse";
import { ISystemTextService } from "@/interfaces/services";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { getPaginationParams } from "@/utils/paginationUtils";
import { isAdminRequest } from "@/utils/auth";

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
    // An admin's own session must always see its own just-made writes, not a cached response
    // shared with anonymous callers (CP-37) — the server-side unstable_cache above is already
    // invalidated correctly on write, but the browser's own HTTP cache isn't.
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(result.data, result.meta, cacheSeconds);
  });

  getSystemTextById = withErrorHandling(async (request: Request, id: string) => {
    const text = await this.systemTextService.getSystemTextById(id);
    if (!text) {
      throw new NotFoundError("System text not found");
    }
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(text, undefined, cacheSeconds);
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

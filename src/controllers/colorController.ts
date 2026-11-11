import { z } from "zod";
import { sendSuccess, CACHE_SECONDS, withErrorHandling } from "@/utils/apiResponse";
import { IColorService } from "@/interfaces/services";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { colorSchema } from "@/common/validation/schemas";
import { getPaginationParams } from "@/utils/paginationUtils";
import { getUserId, isAdminRequest } from "@/utils/auth";

export class ColorController {
  constructor(private colorService: IColorService) {}

  getColors = withErrorHandling(async (request: Request) => {
    const { page, limit } = getPaginationParams(request);
    const result = await this.colorService.getAllColors({ page, limit });
    // An admin's own session must always see its own just-made writes, not a cached response
    // shared with anonymous callers (CP-37).
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(result.data, result.meta, cacheSeconds);
  });

  getColorById = withErrorHandling(async (request: Request, id: string) => {
    const color = await this.colorService.getColorById(id);
    if (!color) {
      throw new NotFoundError("Color not found");
    }
    const cacheSeconds = (await isAdminRequest()) ? undefined : CACHE_SECONDS.lookup;
    return sendSuccess(color, undefined, cacheSeconds);
  });

  saveColor = withErrorHandling(async (request: Request, id?: string) => {
    const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
    if (id) {
      rawBody.id = id;
    }
    const body = await validateRequest(colorSchema.extend({ id: z.string().uuid().optional() }), rawBody);
    const userId = await getUserId();
    const color = await this.colorService.saveColor({ ...body, userId });
    return sendSuccess(color);
  });

  deleteColor = withErrorHandling(async (request: Request, id: string) => {
    const success = await this.colorService.deleteColor(id);
    if (!success) {
      throw new NotFoundError("Color not found");
    }
    return sendSuccess({ success: true });
  });
}


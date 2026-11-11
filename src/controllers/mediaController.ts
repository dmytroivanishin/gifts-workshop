import { z } from "zod";
import { sendSuccess, withErrorHandling } from "@/utils/apiResponse";
import { IMediaService } from "@/interfaces/services";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { mediaSchema, bulkIdsSchema } from "@/common/validation/schemas";
import { getUserId } from "@/utils/auth";
import { ValidationError } from "@/common/errors/validation";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { ConflictError } from "@/common/errors/conflict";
import { MAX_UPLOAD_BODY_BYTES } from "@/utils/uploadLimits";
import { getPaginationParams, getSearchParam } from "@/utils/paginationUtils";

export class MediaController {
  constructor(private mediaService: IMediaService) {}

  getMedia = withErrorHandling(async (request: Request) => {
    const { page, limit } = getPaginationParams(request);
    const search = getSearchParam(request);
    const result = await this.mediaService.getAllMedia({ page, limit, search });
    return sendSuccess(result.data, result.meta);
  });

  getMediaById = withErrorHandling(async (request: Request, id: string) => {
    const media = await this.mediaService.getMediaById(id);
    if (!media) {
      throw new NotFoundError("Media not found");
    }
    return sendSuccess(media);
  });

  saveMedia = withErrorHandling(async (request: Request, id?: string) => {
    // Check if it's FormData (multipart/form-data)
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      // Checked from the header before the body is read: a body over the proxy cap arrives cut, and parsing it
      // would fail with a generic 500 instead of this answer.
      const declaredBytes = Number(request.headers.get("content-length") ?? 0);
      if (declaredBytes > MAX_UPLOAD_BODY_BYTES) {
        throw new ConflictError("File is too large.", "FILE_TOO_LARGE");
      }
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      const userId = await getUserId();
      if (!userId) {
        throw new UnauthorizedError("Unauthorized");
      }
      if (!file) {
        throw new ValidationError("No file provided", [{ field: "file", message: "file is required" }]);
      }

      const savedMedia = await this.mediaService.uploadMedia(file, userId);
      return sendSuccess(savedMedia);
    } else {
      // Fallback for legacy JSON saving (e.g. updating positions)
      const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
      if (id) {
        rawBody.id = id;
      }
      const body = await validateRequest(mediaSchema.extend({ id: z.string().uuid().optional() }), rawBody);
      const userId = await getUserId();
      const media = await this.mediaService.saveMedia({ ...body, userId });
      return sendSuccess(media);
    }
  });

  deleteMedia = withErrorHandling(async (request: Request, id: string) => {
    const success = await this.mediaService.deleteMedia(id);
    if (!success) {
      throw new NotFoundError("Media not found");
    }
    return sendSuccess({ success: true });
  });

  bulkDeleteMedia = withErrorHandling(async (request: Request) => {
    const rawBody = (await parseJsonBody(request)) as Record<string, unknown>;
    const { ids } = await validateRequest(bulkIdsSchema, rawBody);

    const result = await this.mediaService.bulkDeleteMedia(ids);
    return sendSuccess(result);
  });
}


import { z } from "zod";
import { sendSuccess, withErrorHandling } from "@/utils/apiResponse";
import { IMediaService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { mediaSchema } from "@/common/validation/schemas";
import { getUserId } from "@/utils/auth";
import { ValidationError } from "@/common/errors/validation";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { getPaginationParams } from "@/utils/paginationUtils";

export class MediaController {
  constructor(private mediaService: IMediaService) {}

  getMedia = withErrorHandling(async (request: Request) => {
    const { page, limit } = getPaginationParams(request);
    const result = await this.mediaService.getAllMedia({ page, limit });
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
      const rawBody: any = await parseJsonBody(request);
      if (id) {
        rawBody.id = id;
      }
      const body = await validateRequest(mediaSchema.extend({ id: z.string().uuid().optional() }), rawBody);
      const userId = await getUserId();
      const media = await this.mediaService.saveMedia({ ...body, userId } as any);
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
}


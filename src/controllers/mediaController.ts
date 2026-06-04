import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { IMediaService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest } from "@/lib/validateRequest";
import { mediaSchema } from "@/common/validation/schemas";
import { getUserId } from "@/lib/authUtils";
import { ValidationError } from "@/common/errors/validation";
import { UnauthorizedError } from "@/common/errors/unauthorized";
import { getPaginationParams } from "@/utils/paginationUtils";

export class MediaController {
  constructor(private mediaService: IMediaService) {}

  async getMedia(request: Request) {
    try {
      const { page, limit } = getPaginationParams(request);
      const result = await this.mediaService.getAllMedia({ page, limit });
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getMediaById(request: Request, id: string) {
    try {
      const media = await this.mediaService.getMediaById(id);
      if (!media) {
        throw new NotFoundError("Media not found");
      }
      return sendSuccess(media);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async saveMedia(request: Request, id?: string) {
    try {
      // Check if it's FormData (multipart/form-data)
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const files = formData.getAll("files") as File[];
        
        const userId = await getUserId();
        if (!userId) {
          throw new UnauthorizedError("Unauthorized");
        }

        const savedMedia = await this.mediaService.uploadMultiple(files, userId);
        return sendSuccess(savedMedia);
      } else {
        // Fallback for legacy JSON saving (e.g. updating positions)
        const rawBody = await request.json();
        if (id) {
          rawBody.id = id;
        }
        const body = await validateRequest(mediaSchema.extend({ id: z.string().uuid().optional() }), rawBody);
        const media = await this.mediaService.saveMedia(body as any);
        return sendSuccess(media);
      }
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteMedia(request: Request, id: string) {
    try {
      const success = await this.mediaService.deleteMedia(id);
      if (!success) {
        throw new NotFoundError("Media not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}


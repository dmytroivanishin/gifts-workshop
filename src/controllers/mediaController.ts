import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { IMediaService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest } from "@/lib/validateRequest";
import { mediaSchema } from "@/common/validation/schemas";
import { getUserId } from "@/lib/authUtils";
import { ValidationError } from "@/common/errors/validation";
import { UnauthorizedError } from "@/common/errors/unauthorized";

export class MediaController {
  constructor(private mediaService: IMediaService) {}

  async getMedia(request: Request) {
    try {
      const result = await this.mediaService.getAllMedia();
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
        
        if (!files || files.length === 0) {
          throw new ValidationError("No files provided");
        }

        const userId = await getUserId();
        if (!userId) {
          throw new UnauthorizedError("Unauthorized");
        }

        const maxFileSizeBytes = (Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];

        const savedMedia = [];
        for (const file of files) {
          if (!allowedTypes.includes(file.type)) {
            throw new ValidationError(`Invalid file type: ${file.name}. Only JPG and PNG are allowed.`);
          }
          if (file.size > maxFileSizeBytes) {
            throw new ValidationError(`File ${file.name} is too large. Max size is ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 10}MB.`);
          }

          // Convert to buffer
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Delegate to MediaService for storage and DB saving
          const media = await this.mediaService.uploadAndSaveMedia(buffer, file.name, file.type, userId);
          savedMedia.push(media);
        }

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


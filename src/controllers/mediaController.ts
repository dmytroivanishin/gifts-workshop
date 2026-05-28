import { sendSuccess, sendError } from "@/lib/apiResponse";
import { IMediaService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";

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
      const body = await request.json();
      if (id) {
        body.id = id;
      }
      const media = await this.mediaService.saveMedia(body);
      return sendSuccess(media);
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


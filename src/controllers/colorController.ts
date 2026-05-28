import { z } from "zod";
import { sendSuccess, sendError } from "@/lib/apiResponse";
import { IColorService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest } from "@/lib/validateRequest";
import { colorSchema } from "@/common/validation/schemas";

export class ColorController {
  constructor(private colorService: IColorService) {}

  async getColors(request: Request) {
    try {
      const result = await this.colorService.getAllColors();
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getColorById(request: Request, id: string) {
    try {
      const color = await this.colorService.getColorById(id);
      if (!color) {
        throw new NotFoundError("Color not found");
      }
      return sendSuccess(color);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async saveColor(request: Request, id?: string) {
    try {
      const rawBody = await request.json();
      if (id) {
        rawBody.id = id;
      }
      const body = await validateRequest(colorSchema.extend({ id: z.string().uuid().optional() }), rawBody);
      const color = await this.colorService.saveColor(body as any);
      return sendSuccess(color);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteColor(request: Request, id: string) {
    try {
      const success = await this.colorService.deleteColor(id);
      if (!success) {
        throw new NotFoundError("Color not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}


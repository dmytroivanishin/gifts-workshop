import { z } from "zod";
import { sendSuccess, sendError } from "@/utils/apiResponse";
import { IColorService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";
import { validateRequest, parseJsonBody } from "@/utils/validateRequest";
import { colorSchema } from "@/common/validation/schemas";
import { getPaginationParams } from "@/utils/paginationUtils";
import { getUserId } from "@/utils/auth";

export class ColorController {
  constructor(private colorService: IColorService) {}

  async getColors(request: Request) {
    try {
      const { page, limit } = getPaginationParams(request);
      const result = await this.colorService.getAllColors({ page, limit });
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
      const rawBody: any = await parseJsonBody(request);
      if (id) {
        rawBody.id = id;
      }
      const body = await validateRequest(colorSchema.extend({ id: z.string().uuid().optional() }), rawBody);
      const userId = await getUserId();
      const color = await this.colorService.saveColor({ ...body, userId } as any);
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


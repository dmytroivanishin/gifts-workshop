import { sendSuccess, sendError } from "@/lib/apiResponse";
import { IColorService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";

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

  async saveColor(request: Request) {
    try {
      const body = await request.json();
      const color = await this.colorService.saveColor(body);
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

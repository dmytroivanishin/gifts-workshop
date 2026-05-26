import { sendSuccess, sendError } from "@/lib/apiResponse";
import { ILocalizationService } from "@/services/interfaces";
import { NotFoundError } from "@/common/errors/notFound";

export class LocalizationController {
  constructor(private localizationService: ILocalizationService) {}

  async getLocalizations(request: Request) {
    try {
      const result = await this.localizationService.getAllLocalizations();
      return sendSuccess(result.data, result.meta);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async getByEntity(request: Request) {
    try {
      const { searchParams } = new URL(request.url);
      const entityId = searchParams.get("entityId");
      const entityType = searchParams.get("entityType");
      if (!entityId || !entityType) {
        return sendSuccess([]);
      }
      const localizations = await this.localizationService.getByEntity(entityId, entityType);
      return sendSuccess(localizations);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async saveLocalization(request: Request) {
    try {
      const body = await request.json();
      const localization = await this.localizationService.saveLocalization(body);
      return sendSuccess(localization);
    } catch (error: any) {
      return sendError(error);
    }
  }

  async deleteLocalization(request: Request, id: string) {
    try {
      const success = await this.localizationService.deleteLocalization(id);
      if (!success) {
        throw new NotFoundError("Localization not found");
      }
      return sendSuccess({ success: true });
    } catch (error: any) {
      return sendError(error);
    }
  }
}

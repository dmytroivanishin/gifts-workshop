import { ILocalizationRepository } from "@/repositories/interfaces";
import { ILocalizationService } from "./interfaces";
import { Localization } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class LocalizationService implements ILocalizationService {
  constructor(private locRepo: ILocalizationRepository) {}

  async getAllLocalizations(options?: any): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const localizations = await this.locRepo.getAll({
      page,
      limit: limit + 1,
    });

    return paginate(localizations, { page, limit });
  }

  async getLocalizationById(id: string): Promise<Localization | undefined> {
    return this.locRepo.getById(id);
  }

  async getByEntity(entityId: string, entityType: string): Promise<Localization[]> {
    return this.locRepo.getByEntity(entityId, entityType);
  }

  async saveLocalization(body: any): Promise<Localization> {
    const id = body.id || randomUUID();
    const localization: Localization = {
      id,
      locale: body.locale,
      payload: body.payload,
      entityId: body.entityId,
      entityType: body.entityType,
      userId: body.userId,
    };
    return this.locRepo.save(localization);
  }

  async deleteLocalization(id: string): Promise<boolean> {
    return this.locRepo.delete(id);
  }
}

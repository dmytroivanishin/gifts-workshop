import { BaseRepository } from "./baseRepository";
import { ILocalizationRepository, Localization } from "./interfaces";

export class LocalizationRepository extends BaseRepository<Localization> implements ILocalizationRepository {
  constructor() {
    super("localizations");
  }

  async getByEntity(entityId: string, entityType: string): Promise<Localization[]> {
    const all = await this.getAll();
    return all.filter((l: Localization) => l.entityId === entityId && l.entityType === entityType);
  }
}

import { BaseRepository } from "./baseRepository";
import { ISlugRepository, Slug } from "./interfaces";

export class SlugRepository extends BaseRepository<Slug> implements ISlugRepository {
  constructor() {
    super("slugs");
  }

  async getByName(name: string): Promise<Slug | undefined> {
    const all = await this.getAll();
    return all.find((s: Slug) => s.name === name);
  }

  async getByEntity(entityId: string, entityType: string): Promise<Slug | undefined> {
    const all = await this.getAll();
    return all.find((s: Slug) => s.entityId === entityId && s.entityType === entityType);
  }
}

import { ISlugRepository } from "@/repositories/interfaces";
import { ISlugService } from "./interfaces";
import { generateSlugFromField } from "@/lib/slug";
import { Slug } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class SlugService implements ISlugService {
  constructor(private slugRepo: ISlugRepository) {}

  async getAllSlugs(options?: any): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const slugs = await this.slugRepo.getAll({
      page,
      limit: limit + 1,
    });

    return paginate(slugs, { page, limit });
  }

  async getSlugById(id: string): Promise<Slug | undefined> {
    return this.slugRepo.getById(id);
  }

  async getSlugByName(name: string): Promise<Slug | undefined> {
    return this.slugRepo.getByName(name);
  }

  async generateUniqueSlug(
    fieldValue: string | { ru?: string; en?: string } | undefined,
    entityId: string,
    entityType: "post" | "category" | "collection" | "tag"
  ): Promise<string> {
    const baseSlug = await generateSlugFromField(fieldValue);
    let uniqueSlug = baseSlug;
    let suffix = 1;

    while (true) {
      const existing = await this.slugRepo.getByName(uniqueSlug);
      if (!existing || (existing.entityId === entityId && existing.entityType === entityType)) {
        break;
      }
      uniqueSlug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const existingSlugEntity = await this.slugRepo.getByEntity(entityId, entityType);

    const slugEntity: Slug = {
      id: existingSlugEntity ? existingSlugEntity.id : randomUUID(),
      name: uniqueSlug,
      entityId,
      entityType,
    };

    await this.slugRepo.save(slugEntity);
    return uniqueSlug;
  }

  async deleteSlugForEntity(entityId: string, entityType: "post" | "category" | "collection" | "tag"): Promise<boolean> {
    const existing = await this.slugRepo.getByEntity(entityId, entityType);
    if (!existing) return false;
    return this.slugRepo.delete(existing.id);
  }
}

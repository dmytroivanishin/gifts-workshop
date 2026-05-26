import { ITagRepository, ICategoryRepository } from "@/repositories/interfaces";
import { ITagService, ISlugService } from "./interfaces";
import { Tag } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class TagService implements ITagService {
  constructor(
    private tagRepo: ITagRepository,
    private slugService: ISlugService,
    private categoryRepo?: ICategoryRepository
  ) {}

  async getAllTags(options?: any): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const tags = await this.tagRepo.getAll({
      page,
      limit: limit + 1,
    });

    return paginate(tags, { page, limit });
  }

  async getTagById(id: string): Promise<Tag | undefined> {
    return this.tagRepo.getById(id);
  }

  async getTagBySlug(slug: string): Promise<Tag | undefined> {
    return this.tagRepo.getBySlug(slug);
  }

  async saveTag(body: any): Promise<Tag> {
    const id = body.id || randomUUID();
    const tName = body.title?.ru || body.title || body.name || "";
    const slug = await this.slugService.generateUniqueSlug(tName, id, "tag");

    const tag: Tag = {
      id,
      title: typeof body.title === "object" ? body.title : { ru: tName, en: tName },
      slug,
    };

    return this.tagRepo.save(tag);
  }

  async deleteTag(id: string): Promise<boolean> {
    await this.slugService.deleteSlugForEntity(id, "tag");

    // Cascade cleanup: remove tag ID from categories
    if (this.categoryRepo) {
      try {
        const categories = await this.categoryRepo.getAll();
        for (const cat of categories) {
          if (Array.isArray(cat.tagsIds)) {
            const hasTag = cat.tagsIds.includes(id);
            if (hasTag) {
              const updatedTags = cat.tagsIds.filter((t) => t !== id);
              await this.categoryRepo.save({
                ...cat,
                tagsIds: updatedTags,
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to cleanup categories on tag delete", err);
      }
    }

    return this.tagRepo.delete(id);
  }
}

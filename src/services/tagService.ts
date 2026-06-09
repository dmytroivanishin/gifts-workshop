import { ITagRepository, ICategoryRepository } from "@/repositories/interfaces";
import { ITagService } from "./interfaces";
import { Tag } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/utils/slug";
import { isUUID } from "@/utils/uuid";

import { paginate } from "./pagination";

export class TagService implements ITagService {
  constructor(
    private tagRepo: ITagRepository,
    private categoryRepo?: ICategoryRepository
  ) {}

  async getAllTags(options?: any): Promise<any> {
    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const tags = await this.tagRepo.getAll({
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
      });

      return paginate(tags, { page, limit });
    }

    const tags = await this.tagRepo.getAll();
    return paginate(tags, { page: 1, limit: tags.length });
  }

  async getTagById(id: string): Promise<Tag | undefined> {
    if (isUUID(id)) {
      return this.tagRepo.getById(id);
    }
    return this.tagRepo.getBySlug(id);
  }

  async getTagBySlug(slug: string): Promise<Tag | undefined> {
    return this.tagRepo.getBySlug(slug);
  }

  async saveTag(body: any): Promise<Tag> {
    const id = body.id || randomUUID();
    let slug = body.slug;
    if (!slug) {
      slug = await generateUniqueSlug(body.name, id, this.tagRepo.getBySlug.bind(this.tagRepo));
    }

    const tag: Tag = {
      id,
      name: body.name,
      slug,
    };

    return this.tagRepo.save(tag);
  }

  async deleteTag(id: string): Promise<boolean> {
    // Cascade cleanup: remove tag ID from categories
    if (this.categoryRepo) {
      try {
        const categories = await this.categoryRepo.getAll();
        await Promise.all(
          categories
            .filter((cat) => Array.isArray(cat.tagsIds) && cat.tagsIds.includes(id))
            .map((cat) =>
              this.categoryRepo!.save({
                ...cat,
                tagsIds: cat.tagsIds!.filter((t) => t !== id),
              })
            )
        );
      } catch (err) {
        console.error("Failed to cleanup categories on tag delete", err);
      }
    }

    return this.tagRepo.delete(id);
  }
}


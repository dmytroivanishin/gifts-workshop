import { ITagRepository } from "@/repositories/interfaces";
import { ITagService } from "./interfaces";
import { Tag, LocalizedText, PaginatedResult, PaginationOptions } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/utils/slug";
import { isUUID } from "@/utils/uuid";

import { paginate } from "./pagination";

export class TagService implements ITagService {
  constructor(private tagRepo: ITagRepository) {}

  async getAllTags(options?: PaginationOptions): Promise<PaginatedResult<Tag>> {
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

  async saveTag(body: { name: LocalizedText; slug?: string; id?: string; userId?: string }): Promise<Tag> {
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
    // categories_to_tags.tag_id has ON DELETE CASCADE (schema.ts), so Postgres already
    // removes the category/tag links as part of this delete — no app-level cleanup needed.
    return this.tagRepo.delete(id);
  }
}


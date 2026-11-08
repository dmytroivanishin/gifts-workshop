import { unstable_cache, revalidateTag } from "next/cache";
import { ITagRepository, TagQueryOptions } from "@/repositories/interfaces";
import { ITagService } from "./interfaces";
import { Tag, LocalizedText, PaginatedResult } from "@/types";
import { randomUUID } from "crypto";
import { generateUniqueSlug } from "@/utils/slug";
import { isUUID } from "@/utils/uuid";

import { paginate } from "./pagination";

// Same unstable_cache + revalidateTag pattern as SystemTextService/CategoryService (CP-26/CP-37).
const TAGS_CACHE_TAG = "tags";

export class TagService implements ITagService {
  constructor(private tagRepo: ITagRepository) {}

  private getAllCached = unstable_cache(
    async (options?: TagQueryOptions) => this.tagRepo.getAll(options),
    ["tags-get-all"],
    { tags: [TAGS_CACHE_TAG] }
  );

  async getAllTags(options?: TagQueryOptions): Promise<PaginatedResult<Tag>> {
    if (options?.page || options?.limit) {
      const page = options.page || 1;
      const limit = options.limit || 20;

      const tags = await this.getAllCached({
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
        search: options.search,
      });

      return paginate(tags, { page, limit });
    }

    const tags = await this.getAllCached({ search: options?.search });
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

    const saved = await this.tagRepo.save(tag);
    revalidateTag(TAGS_CACHE_TAG, { expire: 0 });
    return saved;
  }

  async deleteTag(id: string): Promise<boolean> {
    // categories_to_tags.tag_id has ON DELETE CASCADE (schema.ts), so Postgres already
    // removes the category/tag links as part of this delete — no app-level cleanup needed.
    const success = await this.tagRepo.delete(id);
    revalidateTag(TAGS_CACHE_TAG, { expire: 0 });
    return success;
  }
}


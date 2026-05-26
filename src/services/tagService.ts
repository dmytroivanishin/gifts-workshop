import { ITagRepository } from "@/repositories/interfaces";
import { ITagService, ISlugService } from "./interfaces";
import { Tag } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class TagService implements ITagService {
  constructor(
    private tagRepo: ITagRepository,
    private slugService: ISlugService
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
    const slug = await this.slugService.generateUniqueSlug(body.name, id, "tag");

    const tag: Tag = {
      id,
      name: body.name,
      categories: body.categories || [],
      slug,
    };

    return this.tagRepo.save(tag);
  }

  async deleteTag(id: string): Promise<boolean> {
    await this.slugService.deleteSlugForEntity(id, "tag");
    return this.tagRepo.delete(id);
  }
}

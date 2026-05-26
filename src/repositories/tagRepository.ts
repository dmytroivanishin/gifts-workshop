import { BaseRepository, repositoryRegistry } from "./baseRepository";
import { ITagRepository } from "./interfaces";
import { Tag } from "@/types";

export class TagRepository extends BaseRepository<Tag> implements ITagRepository {
  constructor() {
    super("tags");
    repositoryRegistry.tag = this;
  }

  protected override async populate(raw: any): Promise<Tag> {
    return raw;
  }

  protected override serialize(tag: Tag): any {
    return {
      id: tag.id,
      title: tag.title,
      slug: tag.slug,
      userId: tag.userId || "user-1",
    };
  }

  async getBySlug(slug: string): Promise<Tag | undefined> {
    const recs = await this.getByQuery({ slug });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }
}

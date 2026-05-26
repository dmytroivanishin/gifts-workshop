import { BaseRepository, registerRepository } from "./baseRepository";
import { ITagRepository } from "./interfaces";
import { Tag } from "@/types";

export class TagRepository extends BaseRepository<Tag> implements ITagRepository {
  constructor() {
    super("tags");
    registerRepository("tags", this);
  }

  async getBySlug(slug: string): Promise<Tag | undefined> {
    const recs = await this.getByQuery({ slug });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }
}

import { BaseRepository, repositoryRegistry } from "./baseRepository";
import { ICollectionRepository } from "./interfaces";
import { Collection } from "@/types";

export class CollectionRepository extends BaseRepository<Collection> implements ICollectionRepository {
  constructor() {
    super("collections");
    repositoryRegistry.collection = this;
  }

  protected override async populate(raw: any): Promise<Collection> {
    return raw;
  }

  protected override serialize(collection: Collection): any {
    return {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      slug: collection.slug,
      main: collection.main,
      userId: collection.userId || "user-1",
    };
  }

  async getBySlug(slug: string): Promise<Collection | undefined> {
    const recs = await this.getByQuery({ slug });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }
}

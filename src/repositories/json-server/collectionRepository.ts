import { BaseRepository, registerRepository } from "./baseRepository";
import { ICollectionRepository } from "../interfaces";
import { Collection } from "@/types";

export class CollectionRepository extends BaseRepository<Collection> implements ICollectionRepository {
  constructor() {
    super("collections");
    registerRepository("collections", this);
  }

  async getBySlug(slug: string): Promise<Collection | undefined> {
    const recs = await this.getByQuery({ slug });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }
}

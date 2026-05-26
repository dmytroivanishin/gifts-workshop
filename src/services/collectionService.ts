import { ICollectionRepository } from "@/repositories/interfaces";
import { ICollectionService, ISlugService } from "./interfaces";
import { Collection } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class CollectionService implements ICollectionService {
  constructor(
    private collectionRepo: ICollectionRepository,
    private slugService: ISlugService
  ) {}

  async getAllCollections(options?: any): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const collections = await this.collectionRepo.getAll({
      page,
      limit: limit + 1,
    });

    return paginate(collections, { page, limit });
  }

  async getCollectionById(id: string): Promise<Collection | undefined> {
    return this.collectionRepo.getById(id);
  }

  async getCollectionBySlug(slug: string): Promise<Collection | undefined> {
    return this.collectionRepo.getBySlug(slug);
  }

  async saveCollection(body: any): Promise<Collection> {
    const id = body.id || randomUUID();
    const slug = await this.slugService.generateUniqueSlug(body.title, id, "collection");

    const collection: Collection = {
      id,
      title: body.title,
      description: body.description ?? "",
      main: body.main ?? false,
      slug,
    };

    return this.collectionRepo.save(collection);
  }

  async deleteCollection(id: string): Promise<boolean> {
    await this.slugService.deleteSlugForEntity(id, "collection");
    return this.collectionRepo.delete(id);
  }
}

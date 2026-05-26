import { ICollectionRepository } from "@/repositories/interfaces";
import { ICollectionService } from "./interfaces";
import { Collection } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField } from "@/lib/slug";

import { paginate } from "./pagination";

export class CollectionService implements ICollectionService {
  constructor(
    private collectionRepo: ICollectionRepository
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
    
    let slug = body.slug;
    if (!slug) {
      const baseSlug = await generateSlugFromField(body.title);
      slug = baseSlug;
      let suffix = 1;
      while (true) {
        const existing = await this.collectionRepo.getBySlug(slug);
        if (!existing || existing.id === id) {
          break;
        }
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }
    }

    const collection: Collection = {
      id,
      title: typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" },
      description: typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" },
      main: body.main ?? false,
      slug,
    };

    return this.collectionRepo.save(collection);
  }

  async deleteCollection(id: string): Promise<boolean> {
    return this.collectionRepo.delete(id);
  }
}


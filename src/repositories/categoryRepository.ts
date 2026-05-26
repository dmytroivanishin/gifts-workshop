import { BaseRepository, registerRepository, repositoryRegistry } from "./baseRepository";
import { ICategoryRepository } from "./interfaces";
import { Category, PopulatedCategory, Tag } from "@/types";
import { NotFoundError } from "@/common/errors/notFound";
import { ValidationError } from "@/common/errors/validation";

export class CategoryRepository extends BaseRepository<Category, PopulatedCategory> implements ICategoryRepository {
  constructor() {
    super("categories");
    registerRepository("categories", this);
  }

  async getBySlug(slug: string): Promise<PopulatedCategory | undefined> {
    const recs = await this.getByQuery({ slug });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }

  protected async populate(cat: Category): Promise<PopulatedCategory> {
    const colorRepo = repositoryRegistry["colors"];
    const collectionRepo = repositoryRegistry["collections"];
    const tagRepo = repositoryRegistry["tags"];

    // 1. Color
    let color = undefined;
    if (cat.colorId && colorRepo) {
      color = await colorRepo.getById(cat.colorId);
    }

    // 2. Collection
    let collection = undefined;
    if (cat.collectionId && collectionRepo) {
      collection = await collectionRepo.getById(cat.collectionId);
    }
    if (!collection) {
      throw new NotFoundError(`Collection with ID ${cat.collectionId} not found for category ${cat.id}`);
    }

    // 3. Parent category (Omitted to prevent N+1 DB queries; UI tree construction)
    const parent = undefined;

    // 4. Tags
    const tags = (cat.tagsIds && tagRepo)
      ? (await Promise.all(cat.tagsIds.map(id => tagRepo.getById(id)))).filter((t): t is Tag => !!t)
      : [];

    return {
      ...cat,
      color,
      collection,
      parent,
      tags,
    };
  }

  async save(item: any): Promise<PopulatedCategory> {
    const collectionRepo = repositoryRegistry["collections"];

    const collectionId = item.collectionId || (item.collection ? (typeof item.collection === "string" ? item.collection : item.collection.id) : undefined);
    if (!collectionId || collectionId === "all") {
      throw new ValidationError("Collection is required to save a category", [
        { field: "collectionId", message: "Collection is required" }
      ]);
    }

    if (collectionRepo) {
      const collection = await collectionRepo.getById(collectionId);
      if (!collection) {
        throw new NotFoundError(`Collection with ID ${collectionId} not found`);
      }
    }

    return super.save(item);
  }

  protected serialize(item: any): Category {
    const raw: any = { ...item };

    // Extricate relation fields
    const colorId = raw.colorId || (raw.color ? (typeof raw.color === "string" ? raw.color : raw.color.id) : undefined);
    const collectionId = raw.collectionId || (raw.collection ? (typeof raw.collection === "string" ? raw.collection : raw.collection.id) : undefined);
    const parentId = raw.parentId || (raw.parent ? (typeof raw.parent === "string" ? raw.parent : raw.parent.id) : undefined);

    let tagsIds = raw.tagsIds;
    if (Array.isArray(raw.tags)) {
      tagsIds = raw.tags.map((t: any) => typeof t === "string" ? t : t.id);
    }

    // Clean relation keys
    delete raw.color;
    delete raw.collection;
    delete raw.parent;
    delete raw.tags;

    return {
      ...raw,
      colorId,
      collectionId,
      parentId,
      tagsIds,
    };
  }
}

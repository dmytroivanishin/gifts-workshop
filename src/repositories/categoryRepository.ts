import { BaseRepository, repositoryRegistry } from "./baseRepository";
import { ICategoryRepository } from "./interfaces";
import { Category, Tag } from "@/types";

export class CategoryRepository extends BaseRepository<Category> implements ICategoryRepository {
  constructor() {
    super("categories");
    repositoryRegistry.category = this;
  }

  protected override async populate(raw: any): Promise<Category> {
    if (!raw) return raw;

    // Resolve color
    let color = undefined;
    if (typeof raw.colorId === "string" && repositoryRegistry.color) {
      color = await repositoryRegistry.color.getById(raw.colorId);
    }

    // Resolve collection
    let collection = undefined;
    if (typeof raw.collectionId === "string" && raw.collectionId !== "all" && repositoryRegistry.collection) {
      collection = await repositoryRegistry.collection.getById(raw.collectionId);
    }

    // Resolve parent
    let parent = undefined;
    if (typeof raw.parentId === "string") {
      parent = await this.getById(raw.parentId);
    }

    // Resolve tags
    let tags: Tag[] = [];
    if (Array.isArray(raw.tagsIds) && repositoryRegistry.tag) {
      for (const tId of raw.tagsIds) {
        if (typeof tId === "string") {
          const foundTag = await repositoryRegistry.tag.getById(tId);
          if (foundTag) {
            tags.push(foundTag);
          }
        }
      }
    }

    return {
      ...raw,
      color,
      collection,
      parent,
      tags,
    };
  }

  protected override serialize(category: Category): any {
    const cat = category as any;
    return {
      id: cat.id,
      title: cat.title,
      description: cat.description,
      slug: cat.slug,
      order: cat.order,
      colorId: cat.colorId || (cat.color ? cat.color.id : undefined),
      collectionId: cat.collectionId || (cat.collection ? cat.collection.id : "all"),
      parentId: cat.parentId || (cat.parent ? cat.parent.id : undefined),
      tagsIds: cat.tagsIds || (cat.tags ? cat.tags.map((t: any) => t.id) : []),
      userId: cat.userId || "user-1",
    };
  }

  async getBySlug(slug: string): Promise<Category | undefined> {
    const recs = await this.getByQuery({ slug });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }
}

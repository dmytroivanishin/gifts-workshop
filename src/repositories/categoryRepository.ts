import { BaseRepository, Database } from "./baseRepository";
import { ICategoryRepository } from "./interfaces";
import { Category, PaginatedResult, PaginationOptions } from "@/types";
import { populateCategory } from "./populator";

const DB_URI = Database.getUri();

export class CategoryRepository extends BaseRepository<Category> implements ICategoryRepository {
  constructor() {
    super("categories");
  }

  override async getById(id: string): Promise<Category | undefined> {
    const res = await fetch(`${DB_URI}/categories/${id}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const raw = await res.json();
    return populateCategory(raw);
  }

  async getBySlug(slug: string): Promise<Category | undefined> {
    const res = await fetch(`${DB_URI}/categories?slug=${slug}`, { cache: "no-store" });
    const recs = await res.json();
    if (!recs || recs.length === 0) return undefined;
    return populateCategory(recs[0]);
  }

  override async getAll(options?: PaginationOptions): Promise<Category[]> {
    let url = `${DB_URI}/categories`;
    if (options?.page || options?.limit) {
      const params = new URLSearchParams();
      if (options.page) params.append("_page", options.page.toString());
      if (options.limit) params.append("_per_page", options.limit.toString());
      url += `?${params.toString()}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch categories");

    const json = await res.json();
    let rawCategories = Array.isArray(json) ? json : json.data || [];

    const categories: Category[] = [];
    for (const raw of rawCategories) {
      categories.push(await populateCategory(raw));
    }

    return categories;
  }

  override async save(category: Category): Promise<Category> {
    const rawCategory = {
      id: category.id,
      title: category.title,
      description: category.description,
      slug: category.slug,
      order: category.order,
      colorId: category.colorId || (category.color ? category.color.id : undefined),
      collectionId: category.collectionId || (category.collection ? category.collection.id : "all"),
      parentId: category.parentId || (category.parent ? category.parent.id : undefined),
      tagsIds: category.tagsIds || (category.tags ? category.tags.map(t => t.id) : []),
      userId: category.userId || "user-1",
    };

    const catCheck = await fetch(`${DB_URI}/categories/${category.id}`, { cache: "no-store" });
    if (catCheck.ok) {
      await fetch(`${DB_URI}/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawCategory),
      });
    } else {
      await fetch(`${DB_URI}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawCategory),
      });
    }

    const res = await fetch(`${DB_URI}/categories/${category.id}`, { cache: "no-store" });
    const rawData = await res.json();
    return populateCategory(rawData);
  }
}


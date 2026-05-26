import { BaseRepository } from "./baseRepository";
import { ICategoryRepository } from "./interfaces";
import { Category, PaginatedResult, PaginationOptions } from "@/types";
import { populateCategory } from "./populator";

const DB_URL = process.env.DB_URL || "http://localhost:3001";

export class CategoryRepository extends BaseRepository<Category> implements ICategoryRepository {
  constructor() {
    super("categories");
  }

  override async getById(id: string): Promise<Category | undefined> {
    const res = await fetch(`${DB_URL}/categories/${id}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const raw = await res.json();
    return populateCategory(raw);
  }

  async getBySlug(slug: string): Promise<Category | undefined> {
    const slugRes = await fetch(`${DB_URL}/slugs?name=${slug}&entityType=category`, { cache: "no-store" });
    const slugRecs = await slugRes.json();
    if (!slugRecs || slugRecs.length === 0) return undefined;
    return this.getById(slugRecs[0].entityId);
  }

  override async getAll(options?: PaginationOptions): Promise<Category[]> {
    let url = `${DB_URL}/categories`;
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
    // 1. Slugs
    if (category.slug) {
      const slugRes = await fetch(`${DB_URL}/slugs?entityId=${category.id}&entityType=category`, { cache: "no-store" });
      const existing = await slugRes.json();
      const slugData = {
        name: category.slug,
        entityId: category.id,
        entityType: "category",
        userId: "user-1",
      };
      if (existing && existing.length > 0) {
        await fetch(`${DB_URL}/slugs/${existing[0].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...existing[0], ...slugData }),
        });
      } else {
        await fetch(`${DB_URL}/slugs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: `slug-${category.id}`, ...slugData }),
        });
      }
    }

    // 2. Localizations
    const titleObj = category.title as any;
    const descObj = category.description as any;
    const ruPayload = JSON.stringify({
      title: typeof titleObj === "string" ? titleObj : titleObj?.ru || "",
      description: typeof descObj === "string" ? descObj : descObj?.ru || "",
    });
    const enPayload = JSON.stringify({
      title: typeof titleObj === "string" ? titleObj : titleObj?.en || "",
      description: typeof descObj === "string" ? descObj : descObj?.en || "",
    });

    // Check ru
    const ruRes = await fetch(`${DB_URL}/localizations?entityId=${category.id}&entityType=category&locale=ru`, { cache: "no-store" });
    const ruExist = await ruRes.json();
    const ruData = {
      locale: "ru",
      payload: ruPayload,
      entityId: category.id,
      entityType: "category",
      userId: "user-1",
    };
    if (ruExist && ruExist.length > 0) {
      await fetch(`${DB_URL}/localizations/${ruExist[0].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ruExist[0], ...ruData }),
      });
    } else {
      await fetch(`${DB_URL}/localizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: `loc-${category.id}-ru`, ...ruData }),
      });
    }

    // Check en
    const enRes = await fetch(`${DB_URL}/localizations?entityId=${category.id}&entityType=category&locale=en`, { cache: "no-store" });
    const enExist = await enRes.json();
    const enData = {
      locale: "en",
      payload: enPayload,
      entityId: category.id,
      entityType: "category",
      userId: "user-1",
    };
    if (enExist && enExist.length > 0) {
      await fetch(`${DB_URL}/localizations/${enExist[0].id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...enExist[0], ...enData }),
      });
    } else {
      await fetch(`${DB_URL}/localizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: `loc-${category.id}-en`, ...enData }),
      });
    }

    // 3. Raw Category
    const rawCategory = {
      id: category.id,
      order: category.order,
      color: typeof category.color === "string" ? category.color : category.color?.id,
      collection: typeof category.collection === "string" ? category.collection : category.collection?.id || "all",
      parent: typeof category.parent === "string" ? category.parent : category.parent?.id,
    };

    const catCheck = await fetch(`${DB_URL}/categories/${category.id}`, { cache: "no-store" });
    if (catCheck.ok) {
      await fetch(`${DB_URL}/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawCategory),
      });
    } else {
      await fetch(`${DB_URL}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawCategory),
      });
    }

    const res = await fetch(`${DB_URL}/categories/${category.id}`, { cache: "no-store" });
    const rawData = await res.json();
    return populateCategory(rawData);
  }
}

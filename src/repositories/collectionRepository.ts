import { BaseRepository } from "./baseRepository";
import { ICollectionRepository } from "./interfaces";
import { Collection, PaginatedResult, PaginationOptions } from "@/types";
import { populateCollection } from "./populator";

const DB_URL = process.env.DB_URL || "http://localhost:3001";

export class CollectionRepository extends BaseRepository<Collection> implements ICollectionRepository {
  constructor() {
    super("collections");
  }

  override async getById(id: string): Promise<Collection | undefined> {
    const res = await fetch(`${DB_URL}/collections/${id}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const raw = await res.json();
    return populateCollection(raw);
  }

  async getBySlug(slug: string): Promise<Collection | undefined> {
    const slugRes = await fetch(`${DB_URL}/slugs?name=${slug}&entityType=collection`, { cache: "no-store" });
    const slugRecs = await slugRes.json();
    if (!slugRecs || slugRecs.length === 0) return undefined;
    return this.getById(slugRecs[0].entityId);
  }

  override async getAll(options?: PaginationOptions): Promise<Collection[]> {
    let url = `${DB_URL}/collections`;
    if (options?.page || options?.limit) {
      const params = new URLSearchParams();
      if (options.page) params.append("_page", options.page.toString());
      if (options.limit) params.append("_per_page", options.limit.toString());
      url += `?${params.toString()}`;
    }
    
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch collections");
    
    const json = await res.json();
    let rawCollections = Array.isArray(json) ? json : json.data || [];

    const collections: Collection[] = [];
    for (const raw of rawCollections) {
      collections.push(await populateCollection(raw));
    }

    return collections;
  }

  override async save(collection: Collection): Promise<Collection> {
    // 1. Slugs
    if (collection.slug) {
      const slugRes = await fetch(`${DB_URL}/slugs?entityId=${collection.id}&entityType=collection`, { cache: "no-store" });
      const existing = await slugRes.json();
      const slugData = {
        name: collection.slug,
        entityId: collection.id,
        entityType: "collection",
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
          body: JSON.stringify({ id: `slug-${collection.id}`, ...slugData }),
        });
      }
    }

    // 2. Localizations
    const titleObj = collection.title as any;
    const descObj = collection.description as any;
    const ruPayload = JSON.stringify({
      title: typeof titleObj === "string" ? titleObj : titleObj?.ru || "",
      description: typeof descObj === "string" ? descObj : descObj?.ru || "",
    });
    const enPayload = JSON.stringify({
      title: typeof titleObj === "string" ? titleObj : titleObj?.en || "",
      description: typeof descObj === "string" ? descObj : descObj?.en || "",
    });

    // Check ru
    const ruRes = await fetch(`${DB_URL}/localizations?entityId=${collection.id}&entityType=collection&locale=ru`, { cache: "no-store" });
    const ruExist = await ruRes.json();
    const ruData = {
      locale: "ru",
      payload: ruPayload,
      entityId: collection.id,
      entityType: "collection",
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
        body: JSON.stringify({ id: `loc-${collection.id}-ru`, ...ruData }),
      });
    }

    // Check en
    const enRes = await fetch(`${DB_URL}/localizations?entityId=${collection.id}&entityType=collection&locale=en`, { cache: "no-store" });
    const enExist = await enRes.json();
    const enData = {
      locale: "en",
      payload: enPayload,
      entityId: collection.id,
      entityType: "collection",
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
        body: JSON.stringify({ id: `loc-${collection.id}-en`, ...enData }),
      });
    }

    // 3. Raw Collection
    const rawCollection = {
      id: collection.id,
      main: collection.main,
    };

    const colCheck = await fetch(`${DB_URL}/collections/${collection.id}`, { cache: "no-store" });
    if (colCheck.ok) {
      await fetch(`${DB_URL}/collections/${collection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawCollection),
      });
    } else {
      await fetch(`${DB_URL}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawCollection),
      });
    }

    const res = await fetch(`${DB_URL}/collections/${collection.id}`, { cache: "no-store" });
    const rawData = await res.json();
    return populateCollection(rawData);
  }
}

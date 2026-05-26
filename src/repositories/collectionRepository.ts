import { BaseRepository, Database } from "./baseRepository";
import { ICollectionRepository } from "./interfaces";
import { Collection, PaginatedResult, PaginationOptions } from "@/types";
import { populateCollection } from "./populator";

const DB_URI = Database.getUri();

export class CollectionRepository extends BaseRepository<Collection> implements ICollectionRepository {
  constructor() {
    super("collections");
  }

  override async getById(id: string): Promise<Collection | undefined> {
    const res = await fetch(`${DB_URI}/collections/${id}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const raw = await res.json();
    return populateCollection(raw);
  }

  async getBySlug(slug: string): Promise<Collection | undefined> {
    const res = await fetch(`${DB_URI}/collections?slug=${slug}`, { cache: "no-store" });
    const recs = await res.json();
    if (!recs || recs.length === 0) return undefined;
    return populateCollection(recs[0]);
  }

  override async getAll(options?: PaginationOptions): Promise<Collection[]> {
    let url = `${DB_URI}/collections`;
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
    const rawCollection = {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      slug: collection.slug,
      main: collection.main,
      userId: collection.userId || "user-1",
    };

    const colCheck = await fetch(`${DB_URI}/collections/${collection.id}`, { cache: "no-store" });
    if (colCheck.ok) {
      await fetch(`${DB_URI}/collections/${collection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawCollection),
      });
    } else {
      await fetch(`${DB_URI}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawCollection),
      });
    }

    const res = await fetch(`${DB_URI}/collections/${collection.id}`, { cache: "no-store" });
    const rawData = await res.json();
    return populateCollection(rawData);
  }
}


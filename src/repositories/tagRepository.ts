import { BaseRepository } from "./baseRepository";
import { ITagRepository } from "./interfaces";
import { Tag, PaginatedResult, PaginationOptions } from "@/types";
import { populateTag } from "./populator";

const DB_URL = process.env.DB_URL || "http://localhost:3001";

export class TagRepository extends BaseRepository<Tag> implements ITagRepository {
  constructor() {
    super("tags");
  }

  override async getById(id: string): Promise<Tag | undefined> {
    const res = await fetch(`${DB_URL}/tags/${id}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const raw = await res.json();
    return populateTag(raw);
  }

  async getBySlug(slug: string): Promise<Tag | undefined> {
    const slugRes = await fetch(`${DB_URL}/slugs?name=${slug}&entityType=tag`, { cache: "no-store" });
    const slugRecs = await slugRes.json();
    if (!slugRecs || slugRecs.length === 0) return undefined;
    return this.getById(slugRecs[0].entityId);
  }

  override async getAll(options?: PaginationOptions): Promise<Tag[]> {
    let url = `${DB_URL}/tags`;
    if (options?.page || options?.limit) {
      const params = new URLSearchParams();
      if (options.page) params.append("_page", options.page.toString());
      if (options.limit) params.append("_per_page", options.limit.toString());
      url += `?${params.toString()}`;
    }
    
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch tags");
    
    const json = await res.json();
    let rawTags = Array.isArray(json) ? json : json.data || [];

    const tags: Tag[] = [];
    for (const raw of rawTags) {
      tags.push(await populateTag(raw));
    }

    return tags;
  }

  override async save(tag: Tag): Promise<Tag> {
    // 1. Slugs
    if (tag.slug) {
      const slugRes = await fetch(`${DB_URL}/slugs?entityId=${tag.id}&entityType=tag`, { cache: "no-store" });
      const existing = await slugRes.json();
      const slugData = {
        name: tag.slug,
        entityId: tag.id,
        entityType: "tag",
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
          body: JSON.stringify({ id: `slug-${tag.id}`, ...slugData }),
        });
      }
    }

    // 2. Raw Tag
    const rawTag = {
      id: tag.id,
      name: tag.name,
      categories: tag.categories,
    };

    const tagCheck = await fetch(`${DB_URL}/tags/${tag.id}`, { cache: "no-store" });
    if (tagCheck.ok) {
      await fetch(`${DB_URL}/tags/${tag.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawTag),
      });
    } else {
      await fetch(`${DB_URL}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawTag),
      });
    }

    const res = await fetch(`${DB_URL}/tags/${tag.id}`, { cache: "no-store" });
    const rawData = await res.json();
    return populateTag(rawData);
  }
}


import { BaseRepository, Database } from "./baseRepository";
import { ITagRepository } from "./interfaces";
import { Tag, PaginatedResult, PaginationOptions } from "@/types";
import { populateTag } from "./populator";

const DB_URI = Database.getUri();

export class TagRepository extends BaseRepository<Tag> implements ITagRepository {
  constructor() {
    super("tags");
  }

  override async getById(id: string): Promise<Tag | undefined> {
    const res = await fetch(`${DB_URI}/tags/${id}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const raw = await res.json();
    return populateTag(raw);
  }

  async getBySlug(slug: string): Promise<Tag | undefined> {
    const res = await fetch(`${DB_URI}/tags?slug=${slug}`, { cache: "no-store" });
    const recs = await res.json();
    if (!recs || recs.length === 0) return undefined;
    return populateTag(recs[0]);
  }

  override async getAll(options?: PaginationOptions): Promise<Tag[]> {
    let url = `${DB_URI}/tags`;
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
    const rawTag = {
      id: tag.id,
      title: tag.title,
      slug: tag.slug,
      userId: tag.userId || "user-1",
    };

    const tagCheck = await fetch(`${DB_URI}/tags/${tag.id}`, { cache: "no-store" });
    if (tagCheck.ok) {
      await fetch(`${DB_URI}/tags/${tag.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawTag),
      });
    } else {
      await fetch(`${DB_URI}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawTag),
      });
    }

    const res = await fetch(`${DB_URI}/tags/${tag.id}`, { cache: "no-store" });
    const rawData = await res.json();
    return populateTag(rawData);
  }
}



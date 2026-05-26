import { BaseRepository, repositoryRegistry } from "./baseRepository";
import { IPostRepository, QueryOptions } from "./interfaces";
import { Post, Tag, PostMedia } from "@/types";

export class PostRepository extends BaseRepository<Post> implements IPostRepository {
  constructor() {
    super("posts");
    repositoryRegistry.post = this;
  }

  protected override async populate(raw: any): Promise<Post> {
    if (!raw) return raw;

    // Resolve collection
    let collection = undefined;
    if (typeof raw.collectionId === "string" && raw.collectionId !== "all" && repositoryRegistry.collection) {
      collection = await repositoryRegistry.collection.getById(raw.collectionId);
    }

    // Resolve category
    let category = undefined;
    if (typeof raw.categoryId === "string" && repositoryRegistry.category) {
      category = await repositoryRegistry.category.getById(raw.categoryId);
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

    // Resolve poster
    let poster = undefined;
    if (typeof raw.posterId === "string" && repositoryRegistry.media) {
      poster = await repositoryRegistry.media.getById(raw.posterId);
    }

    // Resolve media array
    let mediaList: PostMedia[] = [];
    if (Array.isArray(raw.media) && repositoryRegistry.media) {
      for (const m of raw.media) {
        let mediaItem = undefined;
        if (typeof m.mediaId === "string") {
          mediaItem = await repositoryRegistry.media.getById(m.mediaId);
        }
        mediaList.push({
          ...m,
          media: mediaItem,
        });
      }
    }

    return {
      ...raw,
      collection,
      category,
      tags,
      poster,
      media: mediaList,
    };
  }

  protected override serialize(post: Post): any {
    const p = post as any;

    const rawMedia: any[] = [];
    if (Array.isArray(p.media)) {
      for (const pm of p.media) {
        const mId = pm.mediaId || (pm.media ? pm.media.id : undefined);
        if (!mId) continue;
        rawMedia.push({
          id: pm.id || `pm-${p.id}-${mId}`,
          order: pm.order,
          mediaId: mId,
          position: pm.position,
        });
      }
    }

    let posterId = p.posterId || (p.poster ? p.poster.id : undefined);

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      slug: p.slug,
      in_stock: p.in_stock,
      status: p.status,
      collectionId: p.collectionId || (p.collection ? p.collection.id : "all"),
      categoryId: p.categoryId || (p.category ? p.category.id : undefined),
      tagsIds: p.tagsIds || (p.tags ? p.tags.map((t: any) => t.id) : []),
      media: rawMedia,
      posterId: posterId,
      userId: p.userId || "user-1",
    };
  }

  override async save(post: Post): Promise<Post> {
    const p = post as any;

    // Save poster via mediaRepo if present
    if (p.poster && repositoryRegistry.media) {
      await repositoryRegistry.media.save({
        ...p.poster,
        userId: p.poster.userId || "user-1",
      });
    }

    // Save media items via mediaRepo if present
    if (Array.isArray(p.media) && repositoryRegistry.media) {
      for (const pm of p.media) {
        if (pm.media) {
          await repositoryRegistry.media.save({
            ...pm.media,
            userId: pm.media.userId || "user-1",
          });
        }
      }
    }

    // Call super.save to persist post itself
    return super.save(post);
  }

  async getBySlug(slug: string): Promise<Post | undefined> {
    const recs = await this.getByQuery({ slug });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }

  override async getAll(options?: QueryOptions): Promise<Post[]> {
    const params = new URLSearchParams();

    if (options) {
      const { search, category, tag, inStock, status, collectionSlug, postSlug } = options;

      if (status) params.append("status", status);
      if (inStock !== undefined) params.append("in_stock", inStock.toString());

      if (category) {
        let catId = category;
        if (repositoryRegistry.category) {
          const found = await repositoryRegistry.category.getBySlug(category);
          if (found) catId = found.id;
        }
        params.append("categoryId", catId);
      }

      if (collectionSlug) {
        let colId = collectionSlug;
        if (repositoryRegistry.collection) {
          const found = await repositoryRegistry.collection.getBySlug(collectionSlug);
          if (found) colId = found.id;
        }
        params.append("collectionId", colId);
      }

      if (postSlug) {
        params.append("slug", postSlug);
      }

      if (tag) {
        let tagId = tag;
        if (repositoryRegistry.tag) {
          const found = await repositoryRegistry.tag.getBySlug(tag);
          if (found) tagId = found.id;
        }
        params.append("tagsIds", tagId);
      }

      if (search) {
        params.append("q", search);
      }
    }

    if (options?.page || options?.limit) {
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      params.append("_page", page.toString());
      params.append("_per_page", limit.toString());
    }

    const queryString = params.toString();
    const url = `${this.getUrl()}${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Failed to fetch posts`);
    }

    const json = await res.json();
    const rawPosts = Array.isArray(json) ? json : json.data || [];
    return Promise.all(rawPosts.map((p: any) => this.populate(p)));
  }
}

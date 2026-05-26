import { BaseRepository, Database } from "./baseRepository";
import { IPostRepository, QueryOptions } from "./interfaces";
import { Post, PaginatedResult } from "@/types";
import { populatePost } from "./populator";

const DB_URI = Database.getUri();

export class PostRepository extends BaseRepository<Post> implements IPostRepository {
  constructor() {
    super("posts");
  }

  async getBySlug(slug: string): Promise<Post | undefined> {
    const res = await fetch(`${DB_URI}/posts?slug=${slug}`, { cache: "no-store" });
    const recs = await res.json();
    if (!recs || recs.length === 0) return undefined;
    return populatePost(recs[0]);
  }

  override async getById(id: string): Promise<Post | undefined> {
    const res = await fetch(`${DB_URI}/posts/${id}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const raw = await res.json();
    return populatePost(raw);
  }

  override async getAll(options?: QueryOptions): Promise<Post[]> {
    let url = `${DB_URI}/posts?`;

    if (options) {
      const { search, category, tag, inStock, status, collectionSlug, postSlug } = options;

      if (status) url += `&status=${status}`;
      if (inStock !== undefined) url += `&in_stock=${inStock}`;

      if (category) {
        let catId = category;
        const catRes = await fetch(`${DB_URI}/categories?slug=${category}`);
        const catRecs = await catRes.json();
        if (catRecs && catRecs.length > 0) catId = catRecs[0].id;
        url += `&categoryId=${catId}`;
      }

      if (collectionSlug) {
        let colId = collectionSlug;
        const colRes = await fetch(`${DB_URI}/collections?slug=${collectionSlug}`);
        const colRecs = await colRes.json();
        if (colRecs && colRecs.length > 0) colId = colRecs[0].id;
        url += `&collectionId=${colId}`;
      }

      if (postSlug) {
        url += `&slug=${postSlug}`;
      }

      if (tag) {
        let tagId = tag;
        const tagRes = await fetch(`${DB_URI}/tags?slug=${tag}`);
        const tagRecs = await tagRes.json();
        if (tagRecs && tagRecs.length > 0) tagId = tagRecs[0].id;
        url += `&tagsIds=${tagId}`;
      }

      if (search) {
        url += `&q=${search}`;
      }
    }

    if (options?.page || options?.limit) {
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      url += `&_page=${page}&_per_page=${limit}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch posts");
    const json = await res.json();

    let rawPosts = Array.isArray(json) ? json : json.data || [];

    const posts: Post[] = [];
    for (const raw of rawPosts) {
      posts.push(await populatePost(raw));
    }

    return posts;
  }

  override async save(post: Post): Promise<Post> {
    // 1. Media
    let posterId = post.posterId || (post.poster ? post.poster.id : undefined);
    if (post.poster) {
      posterId = post.poster.id;
      const mRes = await fetch(`${DB_URI}/media/${posterId}`, { cache: "no-store" });
      const mData = {
        ...post.poster,
        userId: post.poster.userId || "user-1",
      };
      if (mRes.ok) {
        await fetch(`${DB_URI}/media/${posterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mData),
        });
      } else {
        await fetch(`${DB_URI}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mData),
        });
      }
    }

    const rawMedia: any[] = [];
    if (Array.isArray(post.media)) {
      for (const pm of post.media) {
        const mId = pm.mediaId || (pm.media ? pm.media.id : undefined);
        if (!mId) continue;
        
        if (pm.media) {
          const mRes = await fetch(`${DB_URI}/media/${mId}`, { cache: "no-store" });
          const mData = {
            ...pm.media,
            userId: pm.media.userId || "user-1",
          };
          if (mRes.ok) {
            await fetch(`${DB_URI}/media/${mId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(mData),
            });
          } else {
            await fetch(`${DB_URI}/media`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(mData),
            });
          }
        }
        
        rawMedia.push({
          id: pm.id || `pm-${post.id}-${mId}`,
          order: pm.order,
          mediaId: mId,
          position: pm.position,
        });
      }
    }

    // 2. Raw Post construct (WITH SLUG, TITLE, DESCRIPTION embedded)
    const rawPost = {
      id: post.id,
      title: post.title,
      description: post.description,
      slug: post.slug,
      in_stock: post.in_stock,
      status: post.status,
      collectionId: post.collectionId || (post.collection ? post.collection.id : "all"),
      categoryId: post.categoryId || (post.category ? post.category.id : undefined),
      tagsIds: post.tagsIds || (post.tags ? post.tags.map(t => t.id) : []),
      media: rawMedia,
      posterId: posterId,
      userId: post.userId || "user-1",
    };

    const pCheck = await fetch(`${DB_URI}/posts/${post.id}`, { cache: "no-store" });
    if (pCheck.ok) {
      await fetch(`${DB_URI}/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawPost),
      });
    } else {
      await fetch(`${DB_URI}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawPost),
      });
    }

    const res = await fetch(`${DB_URI}/posts/${post.id}`, { cache: "no-store" });
    const rawData = await res.json();
    return populatePost(rawData);
  }
}


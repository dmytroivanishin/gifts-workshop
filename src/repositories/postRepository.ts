import { BaseRepository } from "./baseRepository";
import { IPostRepository, QueryOptions } from "./interfaces";
import { Post, PaginatedResult } from "@/types";
import { populatePost } from "./populator";

const DB_URL = process.env.DB_URL || "http://localhost:3001";

export class PostRepository extends BaseRepository<Post> implements IPostRepository {
  constructor() {
    super("posts");
  }

  async getBySlug(slug: string): Promise<Post | undefined> {
    const all = await this.getAll();
    return all.find((p) => p.slug === slug);
  }

  override async getById(id: string): Promise<Post | undefined> {
    const res = await fetch(`${DB_URL}/posts/${id}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const raw = await res.json();
    return populatePost(raw);
  }

  override async getAll(options?: QueryOptions): Promise<Post[]> {
    let url = `${DB_URL}/posts?`;
    
    if (options) {
      const { search, category, tag, inStock, status, collectionSlug, postSlug } = options;

      if (status) url += `&status=${status}`;
      if (inStock !== undefined) url += `&in_stock=${inStock}`;

      if (category) {
        let catId = category;
        const slugRes = await fetch(`${DB_URL}/slugs?name=${category}&entityType=category`);
        const slugRecs = await slugRes.json();
        if (slugRecs && slugRecs.length > 0) catId = slugRecs[0].entityId;
        url += `&category=${catId}`;
      }

      if (collectionSlug) {
        let colId = collectionSlug;
        const slugRes = await fetch(`${DB_URL}/slugs?name=${collectionSlug}&entityType=collection`);
        const slugRecs = await slugRes.json();
        if (slugRecs && slugRecs.length > 0) colId = slugRecs[0].entityId;
        url += `&collection=${colId}`;
      }

      if (postSlug) {
        let postId = postSlug;
        const slugRes = await fetch(`${DB_URL}/slugs?name=${postSlug}&entityType=post`);
        const slugRecs = await slugRes.json();
        if (slugRecs && slugRecs.length > 0) postId = slugRecs[0].entityId;
        url += `&id=${postId}`;
      }

      if (tag) {
        let tagId = tag;
        const slugRes = await fetch(`${DB_URL}/slugs?name=${tag}&entityType=tag`);
        const slugRecs = await slugRes.json();
        if (slugRecs && slugRecs.length > 0) tagId = slugRecs[0].entityId;
        else {
          const nameRes = await fetch(`${DB_URL}/tags?name=${tag}`);
          const nameRecs = await nameRes.json();
          if (nameRecs && nameRecs.length > 0) tagId = nameRecs[0].id;
        }
        url += `&tags=${tagId}`;
      }

      if (search) {
         const locRes = await fetch(`${DB_URL}/localizations?entityType=post`);
         const allLocs = await locRes.json();
         const matchedIds = allLocs.filter((l: any) => l.payload.toLowerCase().includes(search.toLowerCase())).map((l: any) => l.entityId);
         if (matchedIds.length > 0) {
            matchedIds.forEach((id: string) => url += `&id=${id}`);
         } else {
            url += `&id=none`;
         }
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
    // 1. Slugs
    if (post.slug) {
      const slugRes = await fetch(`${DB_URL}/slugs?entityId=${post.id}&entityType=post`, { cache: "no-store" });
      const existing = await slugRes.json();
      const slugData = {
        name: post.slug,
        entityId: post.id,
        entityType: "post",
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
          body: JSON.stringify({ id: `slug-${post.id}`, ...slugData }),
        });
      }
    }

    // 2. Localizations
    const titleObj = post.title as any;
    const descObj = post.description as any;
    const ruPayload = JSON.stringify({
      title: titleObj?.ru || "",
      description: descObj?.ru || "",
    });
    const enPayload = JSON.stringify({
      title: titleObj?.en || "",
      description: descObj?.en || "",
    });

    // Ru localization
    const ruRes = await fetch(`${DB_URL}/localizations?entityId=${post.id}&entityType=post&locale=ru`, { cache: "no-store" });
    const ruExist = await ruRes.json();
    const ruData = {
      locale: "ru",
      payload: ruPayload,
      entityId: post.id,
      entityType: "post",
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
        body: JSON.stringify({ id: `loc-${post.id}-ru`, ...ruData }),
      });
    }

    // En localization
    const enRes = await fetch(`${DB_URL}/localizations?entityId=${post.id}&entityType=post&locale=en`, { cache: "no-store" });
    const enExist = await enRes.json();
    const enData = {
      locale: "en",
      payload: enPayload,
      entityId: post.id,
      entityType: "post",
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
        body: JSON.stringify({ id: `loc-${post.id}-en`, ...enData }),
      });
    }

    // 3. Media
    let posterId = "";
    if (post.poster) {
      posterId = post.poster.id;
      const mRes = await fetch(`${DB_URL}/media/${posterId}`, { cache: "no-store" });
      const mData = {
        ...post.poster,
        user: post.poster.user || { id: "user-1", email: "admin@example.com", name: "Admin" },
      };
      if (mRes.ok) {
        await fetch(`${DB_URL}/media/${posterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mData),
        });
      } else {
        await fetch(`${DB_URL}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mData),
        });
      }
    }

    const rawMedia: any[] = [];
    if (Array.isArray(post.media)) {
      for (const pm of post.media) {
        const mId = pm.media.id;
        const mRes = await fetch(`${DB_URL}/media/${mId}`, { cache: "no-store" });
        const mData = {
          ...pm.media,
          user: pm.media.user || { id: "user-1", email: "admin@example.com", name: "Admin" },
        };
        if (mRes.ok) {
          await fetch(`${DB_URL}/media/${mId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mData),
          });
        } else {
          await fetch(`${DB_URL}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mData),
          });
        }
        rawMedia.push({
          id: pm.id || `pm-${post.id}-${mId}`,
          order: pm.order,
          media: mId,
          position: pm.position,
        });
      }
    }

    // 4. Raw Post construct (NO SLUG)
    const rawPost = {
      id: post.id,
      in_stock: post.in_stock,
      status: post.status,
      collection: typeof post.collection === "string" ? post.collection : post.collection?.id || "all",
      category: typeof post.category === "string" ? post.category : post.category?.id,
      tags: Array.isArray(post.tags) ? post.tags.map((t) => typeof t === "string" ? t : t.id) : [],
      media: rawMedia,
      poster: posterId || undefined,
    };

    const pCheck = await fetch(`${DB_URL}/posts/${post.id}`, { cache: "no-store" });
    if (pCheck.ok) {
      await fetch(`${DB_URL}/posts/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawPost),
      });
    } else {
      await fetch(`${DB_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawPost),
      });
    }

    const res = await fetch(`${DB_URL}/posts/${post.id}`, { cache: "no-store" });
    const rawData = await res.json();
    return populatePost(rawData);
  }
}

import { IPostRepository, ICategoryRepository, ITagRepository, ICollectionRepository, QueryOptions } from "@/repositories/interfaces";
import { IPostService } from "./interfaces";
import { Post, PopulatedPost } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/lib/slug";

import { paginate } from "./pagination";

export class PostService implements IPostService {
  constructor(
    private postRepo: IPostRepository,
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository,
    private collectionRepo: ICollectionRepository
  ) {}

  async getFilteredPosts(filters?: QueryOptions): Promise<any> {
    const flatFilters: QueryOptions = { ...filters };

    // Resolve category slug to ID
    if (filters?.category) {
      const cat = await this.categoryRepo.getBySlug(filters.category);
      if (cat) {
        flatFilters.categoryId = cat.id;
      } else {
        flatFilters.categoryId = filters.category;
      }
      delete flatFilters.category;
    }

    // Resolve collection slug to ID
    if (filters?.collectionSlug) {
      const col = await this.collectionRepo.getBySlug(filters.collectionSlug);
      if (col) {
        flatFilters.collectionId = col.id;
      } else {
        flatFilters.collectionId = filters.collectionSlug;
      }
      delete flatFilters.collectionSlug;
    }

    // Resolve tag slug to ID
    if (filters?.tag) {
      const tag = await this.tagRepo.getBySlug(filters.tag);
      if (tag) {
        flatFilters.tagsIds = tag.id;
      } else {
        flatFilters.tagsIds = filters.tag;
      }
      delete flatFilters.tag;
    }

    if (filters?.postSlug) {
      flatFilters.slug = filters.postSlug;
      delete flatFilters.postSlug;
    }

    if (filters?.page || filters?.limit) {
      const page = filters.page || 1;
      const limit = filters.limit || 20;

      const posts = await this.postRepo.getAll({
        ...flatFilters,
        page,
        limit: limit + 1,
      });

      return paginate(posts, { page, limit });
    }

    const posts = await this.postRepo.getAll(flatFilters);
    return {
      data: posts,
      meta: {
        page: 1,
        nextPage: null,
        prevPage: null,
        totalItems: posts.length,
      }
    };
  }

  async getPostById(id: string): Promise<PopulatedPost | undefined> {
    let post = await this.postRepo.getById(id);
    if (!post) {
      post = await this.postRepo.getBySlug(id);
    }
    return post;
  }

  async getPostBySlug(slug: string): Promise<PopulatedPost | undefined> {
    return this.postRepo.getBySlug(slug);
  }

  async createPost(body: any): Promise<PopulatedPost> {
    const id = body.id || randomUUID();

    // 1. Generate slug
    const slug = await generateUniqueSlug(body.title, id, this.postRepo.getBySlug.bind(this.postRepo));

    // 2. Build flat post object
    const flatPost: Post = {
      id,
      title: typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" },
      description: typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" },
      in_stock: body.in_stock ?? true,
      status: body.status ?? "Published",
      collectionId: body.collectionId || "all",
      categoryId: body.categoryId || "",
      tagsIds: Array.isArray(body.tagsIds) ? body.tagsIds : [],
      posterId: body.posterId || undefined,
      media: Array.isArray(body.media) ? body.media : [],
      slug,
      userId: body.userId || "user-1",
    };

    return this.postRepo.save(flatPost);
  }

  async updatePost(id: string, body: any): Promise<PopulatedPost | undefined> {
    const existing = await this.postRepo.getById(id);
    if (!existing) return undefined;

    // 1. Generate/resolve slug if title is modified
    let slug = existing.slug;
    if (body.title && JSON.stringify(body.title) !== JSON.stringify(existing.title)) {
      slug = await generateUniqueSlug(body.title, id, this.postRepo.getBySlug.bind(this.postRepo));
    }

    // 2. Build flat post object
    const flatPost: Post = {
      id,
      title: body.title !== undefined ? (typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" }) : existing.title,
      description: body.description !== undefined ? (typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" }) : existing.description,
      in_stock: body.in_stock ?? existing.in_stock,
      status: body.status ?? existing.status,
      collectionId: body.collectionId ?? existing.collectionId,
      categoryId: body.categoryId ?? existing.categoryId,
      tagsIds: Array.isArray(body.tagsIds) ? body.tagsIds : (existing.tagsIds || []),
      posterId: body.posterId !== undefined ? body.posterId : existing.posterId,
      media: Array.isArray(body.media) ? body.media : (existing.media ? existing.media.map(m => ({
        id: m.id,
        order: m.order,
        mediaId: m.mediaId,
        position: m.position,
      })) : []),
      slug,
      userId: body.userId || existing.userId || "user-1",
    };

    return this.postRepo.save(flatPost);
  }

  async deletePost(id: string): Promise<boolean> {
    return this.postRepo.delete(id);
  }
}

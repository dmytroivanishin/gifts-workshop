import { IPostRepository, ICategoryRepository, ITagRepository, ICollectionRepository, QueryOptions } from "@/repositories/interfaces";
import { IPostService } from "./interfaces";
import { Post, PopulatedPost } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField, generateUniqueSlug } from "@/lib/slug";
import { isUUID } from "@/lib/utils";
import { resolveId, resolveMultipleIds } from "@/utils/idResolver";

import { paginate } from "./pagination";

export class PostService implements IPostService {
  constructor(
    private postRepo: IPostRepository,
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository,
    private collectionRepo: ICollectionRepository
  ) {}

  async getFilteredPosts(filters?: QueryOptions): Promise<any> {
    // 1. Build clean database query options
    const dbOptions: QueryOptions = {
      search: filters?.search,
      inStock: filters?.inStock,
      status: filters?.status,
      populate: filters?.populate,
    };

    // 2. Resolve Category Slug/ID
    if (filters?.category) {
      const resolved = await resolveMultipleIds(filters.category, (slug) =>
        this.categoryRepo.getBySlug(slug)
      );
      dbOptions.categoryId = resolved.length === 1 ? resolved[0] : resolved;
    }

    // 3. Resolve Collection Slug/ID
    if (filters?.collection) {
      dbOptions.collectionId = await resolveId(filters.collection, (slug) =>
        this.collectionRepo.getBySlug(slug)
      );
    }

    // 4. Resolve Tag Slug/ID
    if (filters?.tag) {
      dbOptions.tagsIds = await resolveId(filters.tag, (slug) =>
        this.tagRepo.getBySlug(slug)
      );
    }

    // 5. Resolve Post Slug/ID
    if (filters?.post) {
      const trimmed = filters.post.trim();
      if (isUUID(trimmed)) {
        dbOptions.id = trimmed;
      } else {
        dbOptions.slug = trimmed;
      }
    }

    if (filters?.page || filters?.limit) {
      const page = filters.page || 1;
      const limit = filters.limit || 20;

      const posts = await this.postRepo.getAll({
        ...dbOptions,
        page,
        limit: limit + 1,
      });

      return paginate(posts, { page, limit });
    }

    const posts = await this.postRepo.getAll(dbOptions);
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

  async getPostById(id: string, options?: { populate?: string }): Promise<PopulatedPost | undefined> {
    if (isUUID(id)) {
      return this.postRepo.getById(id, options);
    }
    return this.postRepo.getBySlug(id, options);
  }

  async getPostBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedPost | undefined> {
    return this.postRepo.getBySlug(slug, options);
  }

  async createPost(body: any): Promise<PopulatedPost> {
    const id = body.id || randomUUID();
    const slug = await generateUniqueSlug(body.title, id, this.postRepo.getBySlug.bind(this.postRepo));

    const flatPost: Post = {
      id,
      title: body.title,
      description: body.description,
      in_stock: body.in_stock ?? true,
      status: body.status ?? "Published",
      collectionId: body.collectionId,
      categoryId: body.categoryId,
      tagsIds: body.tagsIds || [],
      posterId: body.posterId,
      media: body.media || [],
      slug,
      userId: body.userId,
    };

    return this.postRepo.save(flatPost);
  }

  async updatePost(id: string, body: any): Promise<PopulatedPost | undefined> {
    const existing = await this.postRepo.getById(id);
    if (!existing) return undefined;

    let slug = existing.slug;
    if (body.title && JSON.stringify(body.title) !== JSON.stringify(existing.title)) {
      slug = await generateUniqueSlug(body.title, id, this.postRepo.getBySlug.bind(this.postRepo));
    }

    const flatPost: Post = {
      id,
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      in_stock: body.in_stock ?? existing.in_stock,
      status: body.status ?? existing.status,
      collectionId: body.collectionId ?? existing.collectionId,
      categoryId: body.categoryId ?? existing.categoryId,
      tagsIds: body.tagsIds || existing.tagsIds || [],
      posterId: body.posterId ?? existing.posterId,
      media: body.media || (existing.media ? existing.media.map(m => ({
        id: m.id,
        order: m.order,
        mediaId: m.mediaId,
        position: m.position,
      })) : []),
      slug,
      userId: body.userId ?? existing.userId,
    };

    return this.postRepo.save(flatPost);
  }

  async deletePost(id: string): Promise<boolean> {
    return this.postRepo.delete(id);
  }
}

import { unstable_cache, revalidateTag } from "next/cache";
import { IPostRepository, ICategoryRepository, ITagRepository, ICollectionRepository, QueryOptions } from "@/repositories/interfaces";
import { IPostService } from "./interfaces";
import { Post, PopulatedPost, Category, PaginatedResult } from "@/types";
import { randomUUID } from "crypto";
import { generateUniqueSlug } from "@/utils/slug";
import { isUUID } from "@/utils/uuid";
import { resolveId, resolveMultipleIds } from "@/utils/idResolver";

import { paginate } from "./pagination";

// Same unstable_cache + revalidateTag pattern as CategoryService/CollectionService/TagService/
// ColorService (CP-26/CP-37). A PopulatedPost embeds a live-joined category (itself embedding
// color and collection), collection, tags and poster/media — so every cache entry here also
// carries those entities' own tags, meaning the revalidateTag calls already made in those 4
// services (on their own writes) flush the posts cache too, with no extra fan-out code needed.
const POSTS_CACHE_TAG = "posts";
const POSTS_RELATED_TAGS = [POSTS_CACHE_TAG, "categories", "collections", "tags", "colors"];

export class PostService implements IPostService {
  constructor(
    private postRepo: IPostRepository,
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository,
    private collectionRepo: ICollectionRepository
  ) {}

  private getAllCached = unstable_cache(
    async (options?: QueryOptions) => this.postRepo.getAll(options),
    ["posts-get-all"],
    { tags: POSTS_RELATED_TAGS }
  );

  private getByIdCached = unstable_cache(
    async (id: string) => this.postRepo.getById(id),
    ["posts-get-by-id"],
    { tags: POSTS_RELATED_TAGS }
  );

  private getBySlugCached = unstable_cache(
    async (slug: string) => this.postRepo.getBySlug(slug),
    ["posts-get-by-slug"],
    { tags: POSTS_RELATED_TAGS }
  );

  private async syncCategoryTags(categoryId: string | null | undefined, tagsIds: string[] | undefined) {
    if (!categoryId || !tagsIds || tagsIds.length === 0) return;

    const category = await this.categoryRepo.getById(categoryId);
    if (!category) return;

    const existingTags = category.tagsIds || [];
    const newTags = Array.from(new Set([...existingTags, ...tagsIds]));

    if (newTags.length !== existingTags.length) {
      await this.categoryRepo.save({
        ...category,
        tagsIds: newTags
      } as Category);
      // This writes to categories directly through the repo, bypassing CategoryService's own
      // save (and its revalidateTag) — the categories cache needs invalidating here too.
      revalidateTag("categories", { expire: 0 });
    }
  }

  async getFilteredPosts(filters?: QueryOptions): Promise<PaginatedResult<PopulatedPost>> {
    // 1. Build clean database query options
    const dbOptions: QueryOptions = {
      search: filters?.search,
      inStock: filters?.inStock,
      status: filters?.status,
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

      const posts = await this.getAllCached({
        ...dbOptions,
        page,
        limit: limit + 1,
        offset: (page - 1) * limit,
      });

      return paginate(posts, { page, limit });
    }

    const posts = await this.getAllCached(dbOptions);
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
    if (isUUID(id)) {
      return this.getByIdCached(id);
    }
    return this.getBySlugCached(id);
  }

  async getPostBySlug(slug: string): Promise<PopulatedPost | undefined> {
    return this.getBySlugCached(slug);
  }

  async createPost(body: any): Promise<PopulatedPost> {
    const id = body.id || randomUUID();
    const slug = await generateUniqueSlug(body.title, id, this.postRepo.getBySlug.bind(this.postRepo));

    const flatPost: Post = {
      id,
      title: body.title,
      description: body.description,
      inStock: body.inStock ?? true,
      status: body.status ?? "Published",
      collectionId: body.collectionId,
      categoryId: body.categoryId,
      tagsIds: body.tagsIds || [],
      posterId: body.posterId,
      media: body.media || [],
      slug,
      userId: body.userId,
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
    };

    const saved = await this.postRepo.save(flatPost);
    await this.syncCategoryTags(flatPost.categoryId, flatPost.tagsIds);
    revalidateTag(POSTS_CACHE_TAG, { expire: 0 });
    return saved;
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
      inStock: body.inStock ?? existing.inStock,
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
      createdAt: body.createdAt ? new Date(body.createdAt) : existing.createdAt,
    };

    const saved = await this.postRepo.save(flatPost);
    await this.syncCategoryTags(flatPost.categoryId, flatPost.tagsIds);
    revalidateTag(POSTS_CACHE_TAG, { expire: 0 });
    return saved;
  }

  async deletePost(id: string): Promise<boolean> {
    const success = await this.postRepo.delete(id);
    revalidateTag(POSTS_CACHE_TAG, { expire: 0 });
    return success;
  }

  // One DELETE for the whole batch. Unlike media there is no "in use" protection to apply: comments,
  // gallery rows and tag links go with their post through the foreign keys' ON DELETE CASCADE, and
  // the media files themselves stay in the library. An id that no longer exists is simply absent
  // from `deleted`.
  async bulkDeletePosts(ids: string[]): Promise<{ deleted: string[] }> {
    const deleted = await this.postRepo.deleteMany([...new Set(ids)]);
    revalidateTag(POSTS_CACHE_TAG, { expire: 0 });
    return { deleted };
  }
}

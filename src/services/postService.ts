import { IPostRepository, ICategoryRepository, ITagRepository, ICollectionRepository, QueryOptions } from "@/repositories/interfaces";
import { IPostService, ISlugService } from "./interfaces";
import { Post } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";

export class PostService implements IPostService {
  constructor(
    private postRepo: IPostRepository,
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository,
    private collectionRepo: ICollectionRepository,
    private slugService: ISlugService
  ) {}

  async getFilteredPosts(filters?: QueryOptions): Promise<any> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const posts = await this.postRepo.getAll({
      ...filters,
      page,
      limit: limit + 1,
    });

    return paginate(posts, { page, limit });
  }

  async getPostById(id: string): Promise<Post | undefined> {
    const post = await this.postRepo.getById(id);
    if (post) return post;
    return this.postRepo.getBySlug(id);
  }

  async getPostBySlug(slug: string): Promise<Post | undefined> {
    return this.postRepo.getBySlug(slug);
  }

  async createPost(body: any): Promise<Post> {
    const id = body.id || randomUUID();
    
    // 1. Generate smart translated unique English slug
    const slug = await this.slugService.generateUniqueSlug(body.title, id, "post");

    // 2. Resolve database Category relation
    const categories = await this.categoryRepo.getAll();
    let categoryDetail = body.category;
    if (typeof body.category === "string") {
      const foundCat = categories.find((c) => c.id === body.category || c.slug === body.category);
      if (foundCat) categoryDetail = foundCat;
    }

    // 3. Resolve database Collection relation
    const collections = await this.collectionRepo.getAll();
    let collectionDetail = body.collection || "all";
    if (typeof body.collection === "string" && body.collection !== "all") {
      const foundCol = collections.find((c) => c.id === body.collection || c.slug === body.collection);
      if (foundCol) collectionDetail = foundCol;
    }

    // 4. Resolve database Tags relation
    const allTags = await this.tagRepo.getAll();
    let tagsList: any[] = [];
    if (Array.isArray(body.tags)) {
      for (const t of body.tags) {
        if (typeof t === "string") {
          const foundTag = allTags.find((tag) => tag.id === t || tag.slug === t || tag.name.toLowerCase() === t.toLowerCase());
          if (foundTag) {
            tagsList.push(foundTag);
          } else {
            // Implicit tag creation on the fly
            const tagId = randomUUID();
            const tagSlug = await this.slugService.generateUniqueSlug(t, tagId, "tag");
            const newTag = await this.tagRepo.save({
              id: tagId,
              name: t,
              slug: tagSlug
            });
            tagsList.push(newTag);

            // Associate with category
            if (categoryDetail && typeof categoryDetail === "object") {
              const catObj = await this.categoryRepo.getById(categoryDetail.id);
              if (catObj) {
                const catTags: string[] = Array.isArray(catObj.tags)
                  ? catObj.tags.map((ct: any) => typeof ct === "string" ? ct : ct.id)
                  : [];
                const tagIdStr = newTag.id;
                const hasTag = catTags.includes(tagIdStr);
                if (!hasTag) {
                  await this.categoryRepo.save({
                    ...catObj,
                    tags: [...catTags, tagIdStr],
                  });
                }
              }
            }
          }
        } else if (t && typeof t === "object") {
          const tagId = t.id || randomUUID();
          const tagSlug = t.slug || await this.slugService.generateUniqueSlug(t.name, tagId, "tag");
          const savedTag = await this.tagRepo.save({
            id: tagId,
            name: t.name,
            slug: tagSlug
          });
          tagsList.push(savedTag);

          // Associate with category
          if (categoryDetail && typeof categoryDetail === "object") {
            const catObj = await this.categoryRepo.getById(categoryDetail.id);
            if (catObj) {
              const catTags: string[] = Array.isArray(catObj.tags)
                ? catObj.tags.map((ct: any) => typeof ct === "string" ? ct : ct.id)
                : [];
              const tagIdStr = savedTag.id;
              const hasTag = catTags.includes(tagIdStr);
              if (!hasTag) {
                await this.categoryRepo.save({
                  ...catObj,
                  tags: [...catTags, tagIdStr],
                });
              }
            }
          }
        }
      }
    }

    const newPost: Post = {
      id,
      title: body.title,
      description: body.description,
      in_stock: body.in_stock ?? true,
      status: body.status ?? "Published",
      collection: collectionDetail,
      category: categoryDetail,
      tags: tagsList,
      media: body.media ?? [],
      poster: body.poster,
      slug,
    };

    return this.postRepo.save(newPost);
  }

  async updatePost(id: string, body: any): Promise<Post | undefined> {
    const existing = await this.postRepo.getById(id);
    if (!existing) return undefined;

    // 1. Generate/resolve slug if title is modified
    let slug = existing.slug;
    if (body.title && JSON.stringify(body.title) !== JSON.stringify(existing.title)) {
      slug = await this.slugService.generateUniqueSlug(body.title, id, "post");
    }

    // 2. Resolve Category relation
    const categories = await this.categoryRepo.getAll();
    let categoryDetail = body.category !== undefined ? body.category : existing.category;
    if (typeof categoryDetail === "string") {
      const foundCat = categories.find((c) => c.id === categoryDetail || c.slug === categoryDetail);
      if (foundCat) categoryDetail = foundCat;
    }

    // 3. Resolve Collection relation
    const collections = await this.collectionRepo.getAll();
    let collectionDetail = body.collection !== undefined ? body.collection : existing.collection;
    if (typeof collectionDetail === "string" && collectionDetail !== "all") {
      const foundCol = collections.find((c) => c.id === collectionDetail || c.slug === collectionDetail);
      if (foundCol) collectionDetail = foundCol;
    }

    // 4. Resolve Tags relation
    const allTags = await this.tagRepo.getAll();
    let tagsList: any[] = [];
    if (Array.isArray(body.tags)) {
      for (const t of body.tags) {
        if (typeof t === "string") {
          const foundTag = allTags.find((tag) => tag.id === t || tag.slug === t || tag.name.toLowerCase() === t.toLowerCase());
          if (foundTag) {
            tagsList.push(foundTag);
          } else {
            // Implicit tag creation
            const tagId = randomUUID();
            const tagSlug = await this.slugService.generateUniqueSlug(t, tagId, "tag");
            const newTag = await this.tagRepo.save({
              id: tagId,
              name: t,
              slug: tagSlug
            });
            tagsList.push(newTag);

            // Associate with category
            if (categoryDetail && typeof categoryDetail === "object") {
              const catObj = await this.categoryRepo.getById(categoryDetail.id);
              if (catObj) {
                const catTags: string[] = Array.isArray(catObj.tags)
                  ? catObj.tags.map((ct: any) => typeof ct === "string" ? ct : ct.id)
                  : [];
                const tagIdStr = newTag.id;
                const hasTag = catTags.includes(tagIdStr);
                if (!hasTag) {
                  await this.categoryRepo.save({
                    ...catObj,
                    tags: [...catTags, tagIdStr],
                  });
                }
              }
            }
          }
        } else if (t && typeof t === "object") {
          const tagId = t.id || randomUUID();
          const tagSlug = t.slug || await this.slugService.generateUniqueSlug(t.name, tagId, "tag");
          const savedTag = await this.tagRepo.save({
            id: tagId,
            name: t.name,
            slug: tagSlug
          });
          tagsList.push(savedTag);

          // Associate with category
          if (categoryDetail && typeof categoryDetail === "object") {
            const catObj = await this.categoryRepo.getById(categoryDetail.id);
            if (catObj) {
              const catTags: string[] = Array.isArray(catObj.tags)
                ? catObj.tags.map((ct: any) => typeof ct === "string" ? ct : ct.id)
                : [];
              const tagIdStr = savedTag.id;
              const hasTag = catTags.includes(tagIdStr);
              if (!hasTag) {
                await this.categoryRepo.save({
                  ...catObj,
                  tags: [...catTags, tagIdStr],
                });
              }
            }
          }
        }
      }
    } else {
      tagsList = existing.tags;
    }

    const updatedData = {
      ...body,
      category: categoryDetail,
      collection: collectionDetail,
      tags: tagsList,
      slug,
    };

    return this.postRepo.save({
      ...existing,
      ...updatedData,
      id,
    });
  }

  async deletePost(id: string): Promise<boolean> {
    await this.slugService.deleteSlugForEntity(id, "post");
    return this.postRepo.delete(id);
  }
}

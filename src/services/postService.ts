import { IPostRepository, ICategoryRepository, ITagRepository, ICollectionRepository, QueryOptions } from "@/repositories/interfaces";
import { IPostService } from "./interfaces";
import { Post } from "@/types";
import { randomUUID } from "crypto";
import { generateSlugFromField } from "@/lib/slug";

import { paginate } from "./pagination";

export class PostService implements IPostService {
  constructor(
    private postRepo: IPostRepository,
    private categoryRepo: ICategoryRepository,
    private tagRepo: ITagRepository,
    private collectionRepo: ICollectionRepository
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
    const baseSlug = await generateSlugFromField(body.title);
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await this.postRepo.getBySlug(slug);
      if (!existing || existing.id === id) {
        break;
      }
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

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
          const foundTag = allTags.find((tag) => 
            tag.id === t || 
            tag.slug === t || 
            tag.title?.ru?.toLowerCase() === t.toLowerCase() ||
            tag.title?.en?.toLowerCase() === t.toLowerCase()
          );
          if (foundTag) {
            tagsList.push(foundTag);
          } else {
            // Implicit tag creation on the fly
            const tagId = randomUUID();
            const baseTagSlug = await generateSlugFromField(t);
            let tagSlug = baseTagSlug;
            let tagSuffix = 1;
            while (true) {
              const existingTag = await this.tagRepo.getBySlug(tagSlug);
              if (!existingTag || existingTag.id === tagId) {
                break;
              }
              tagSlug = `${baseTagSlug}-${tagSuffix}`;
              tagSuffix++;
            }
            const newTag = await this.tagRepo.save({
              id: tagId,
              title: { ru: t, en: t },
              slug: tagSlug
            });
            tagsList.push(newTag);
 
            // Associate with category
            if (categoryDetail && typeof categoryDetail === "object") {
              const catObj = await this.categoryRepo.getById(categoryDetail.id);
              if (catObj) {
                const catTags: string[] = Array.isArray(catObj.tagsIds) ? catObj.tagsIds : [];
                const tagIdStr = newTag.id;
                const hasTag = catTags.includes(tagIdStr);
                if (!hasTag) {
                  await this.categoryRepo.save({
                    ...catObj,
                    tagsIds: [...catTags, tagIdStr],
                  });
                }
              }
            }
          }
        } else if (t && typeof t === "object") {
          const tagId = t.id || randomUUID();
          const tName = t.name || t.title?.ru || t.title || "";
          let tagSlug = t.slug;
          if (!tagSlug) {
            const baseTagSlug = await generateSlugFromField(tName);
            tagSlug = baseTagSlug;
            let tagSuffix = 1;
            while (true) {
              const existingTag = await this.tagRepo.getBySlug(tagSlug);
              if (!existingTag || existingTag.id === tagId) {
                break;
              }
              tagSlug = `${baseTagSlug}-${tagSuffix}`;
              tagSuffix++;
            }
          }
          const savedTag = await this.tagRepo.save({
            id: tagId,
            title: typeof t.title === "object" ? t.title : { ru: tName, en: tName },
            slug: tagSlug
          });
          tagsList.push(savedTag);

          // Associate with category
          if (categoryDetail && typeof categoryDetail === "object") {
            const catObj = await this.categoryRepo.getById(categoryDetail.id);
            if (catObj) {
              const catTags: string[] = Array.isArray(catObj.tagsIds) ? catObj.tagsIds : [];
              const tagIdStr = savedTag.id;
              const hasTag = catTags.includes(tagIdStr);
              if (!hasTag) {
                await this.categoryRepo.save({
                  ...catObj,
                  tagsIds: [...catTags, tagIdStr],
                });
              }
            }
          }
        }
      }
    }

    const newPost: any = {
      id,
      title: typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" },
      description: typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" },
      in_stock: body.in_stock ?? true,
      status: body.status ?? "Published",
      collectionId: body.collectionId || (collectionDetail ? (typeof collectionDetail === "string" ? collectionDetail : collectionDetail.id) : "all"),
      categoryId: body.categoryId || (categoryDetail ? (typeof categoryDetail === "string" ? categoryDetail : categoryDetail.id) : ""),
      tagsIds: tagsList.map(t => t.id),
      posterId: body.posterId || (body.poster ? body.poster.id : undefined),
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
    const existing = await this.postRepo.getById(id) as any;
    if (!existing) return undefined;

    // 1. Generate/resolve slug if title is modified
    let slug = existing.slug;
    if (body.title && JSON.stringify(body.title) !== JSON.stringify(existing.title)) {
      const baseSlug = await generateSlugFromField(body.title);
      slug = baseSlug;
      let suffix = 1;
      while (true) {
        const existingPost = await this.postRepo.getBySlug(slug);
        if (!existingPost || existingPost.id === id) {
          break;
        }
        slug = `${baseSlug}-${suffix}`;
        suffix++;
      }
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
          const foundTag = allTags.find((tag) => 
            tag.id === t || 
            tag.slug === t || 
            tag.title?.ru?.toLowerCase() === t.toLowerCase() ||
            tag.title?.en?.toLowerCase() === t.toLowerCase()
          );
          if (foundTag) {
            tagsList.push(foundTag);
          } else {
            // Implicit tag creation
            const tagId = randomUUID();
            const baseTagSlug = await generateSlugFromField(t);
            let tagSlug = baseTagSlug;
            let tagSuffix = 1;
            while (true) {
              const existingTag = await this.tagRepo.getBySlug(tagSlug);
              if (!existingTag || existingTag.id === tagId) {
                break;
              }
              tagSlug = `${baseTagSlug}-${tagSuffix}`;
              tagSuffix++;
            }
            const newTag = await this.tagRepo.save({
              id: tagId,
              title: { ru: t, en: t },
              slug: tagSlug
            });
            tagsList.push(newTag);
 
            // Associate with category
            if (categoryDetail && typeof categoryDetail === "object") {
              const catObj = await this.categoryRepo.getById(categoryDetail.id);
              if (catObj) {
                const catTags: string[] = Array.isArray(catObj.tagsIds) ? catObj.tagsIds : [];
                const tagIdStr = newTag.id;
                const hasTag = catTags.includes(tagIdStr);
                if (!hasTag) {
                  await this.categoryRepo.save({
                    ...catObj,
                    tagsIds: [...catTags, tagIdStr],
                  });
                }
              }
            }
          }
        } else if (t && typeof t === "object") {
          const tagId = t.id || randomUUID();
          const tName = t.name || t.title?.ru || t.title || "";
          let tagSlug = t.slug;
          if (!tagSlug) {
            const baseTagSlug = await generateSlugFromField(tName);
            tagSlug = baseTagSlug;
            let tagSuffix = 1;
            while (true) {
              const existingTag = await this.tagRepo.getBySlug(tagSlug);
              if (!existingTag || existingTag.id === tagId) {
                break;
              }
              tagSlug = `${baseTagSlug}-${tagSuffix}`;
              tagSuffix++;
            }
          }
          const savedTag = await this.tagRepo.save({
            id: tagId,
            title: typeof t.title === "object" ? t.title : { ru: tName, en: tName },
            slug: tagSlug
          });
          tagsList.push(savedTag);

          // Associate with category
          if (categoryDetail && typeof categoryDetail === "object") {
            const catObj = await this.categoryRepo.getById(categoryDetail.id);
            if (catObj) {
              const catTags: string[] = Array.isArray(catObj.tagsIds) ? catObj.tagsIds : [];
              const tagIdStr = savedTag.id;
              const hasTag = catTags.includes(tagIdStr);
              if (!hasTag) {
                await this.categoryRepo.save({
                  ...catObj,
                  tagsIds: [...catTags, tagIdStr],
                });
              }
            }
          }
        }
      }
    } else {
      tagsList = existing.tags || [];
    }

    const updatedData = {
      ...body,
      title: body.title !== undefined ? (typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" }) : existing.title,
      description: body.description !== undefined ? (typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" }) : existing.description,
      collectionId: body.collectionId || (collectionDetail ? (typeof collectionDetail === "string" ? collectionDetail : collectionDetail.id) : existing.collectionId),
      categoryId: body.categoryId || (categoryDetail ? (typeof categoryDetail === "string" ? categoryDetail : categoryDetail.id) : existing.categoryId),
      tagsIds: tagsList.map(t => t.id),
      posterId: body.posterId || (body.poster ? body.poster.id : existing.posterId),
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
    return this.postRepo.delete(id);
  }
}

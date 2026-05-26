import { ICategoryRepository, IColorRepository, ITagRepository } from "@/repositories/interfaces";
import { ICategoryService, ISlugService } from "./interfaces";
import { Category } from "@/types";
import { randomUUID } from "crypto";

import { paginate } from "./pagination";
import { PaginationOptions } from "@/types";

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepo: ICategoryRepository,
    private slugService: ISlugService,
    private colorRepo: IColorRepository,
    private tagRepo: ITagRepository
  ) {}

  async getAllCategories(options?: PaginationOptions): Promise<any> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const categories = await this.categoryRepo.getAll({
      page,
      limit: limit + 1,
    });

    return paginate(categories, { page, limit });
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    return this.categoryRepo.getById(id);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    return this.categoryRepo.getBySlug(slug);
  }

  async saveCategory(body: any): Promise<Category> {
    const id = body.id || randomUUID();
    const categories = await this.categoryRepo.getAll();

    let slug = body.slug;
    if (!slug || (body.title && body.title !== body._originalTitle)) {
      slug = await this.slugService.generateUniqueSlug(body.title, id, "category");
    }

    let colorVal = body.color;
    if (body.color && typeof body.color === "object") {
      const colorId = body.color.id || randomUUID();
      await this.colorRepo.save({
        id: colorId,
        color: body.color.color,
      });
      colorVal = colorId;
    }

    // Process Tags
    const allTags = await this.tagRepo.getAll();
    let tagsList: any[] = [];
    if (Array.isArray(body.tags)) {
      for (const t of body.tags) {
        if (typeof t === "string") {
          const foundTag = allTags.find((tag) => tag.id === t || tag.slug === t || tag.name.toLowerCase() === t.toLowerCase());
          if (foundTag) {
            tagsList.push(foundTag.id || foundTag);
          } else {
            const tagId = randomUUID();
            const tagSlug = await this.slugService.generateUniqueSlug(t, tagId, "tag");
            const newTag = await this.tagRepo.save({
              id: tagId,
              name: t,
              categories: [id],
              slug: tagSlug
            });
            tagsList.push(newTag.id);
          }
        } else if (t && typeof t === "object") {
          const tagId = t.id || randomUUID();
          const tagSlug = t.slug || await this.slugService.generateUniqueSlug(t.name, tagId, "tag");
          const savedTag = await this.tagRepo.save({
            id: tagId,
            name: t.name,
            categories: t.categories || [id],
            slug: tagSlug
          });
          tagsList.push(savedTag.id);
        }
      }
    } else {
      // Keep existing tags if updating without modifying tags
      const existing = await this.categoryRepo.getById(id);
      if (existing && existing.tags) {
        tagsList = existing.tags;
      }
    }

    const category: Category = {
      id,
      title: body.title,
      description: body.description ?? "",
      order: body.order ?? categories.length + 1,
      parent: body.parent,
      color: colorVal,
      collection: body.collection ?? "all",
      tags: tagsList,
      slug,
    };

    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<boolean> {
    await this.slugService.deleteSlugForEntity(id, "category");
    return this.categoryRepo.delete(id);
  }
}

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
    let tagsList: string[] = [];
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
            tagsList.push(foundTag.id);
          } else {
            const tagId = randomUUID();
            const tagSlug = await this.slugService.generateUniqueSlug(t, tagId, "tag");
            const newTag = await this.tagRepo.save({
              id: tagId,
              title: { ru: t, en: t },
              slug: tagSlug
            });
            tagsList.push(newTag.id);
          }
        } else if (t && typeof t === "object") {
          const tagId = t.id || randomUUID();
          const tName = t.name || t.title?.ru || t.title || "";
          const tagSlug = t.slug || await this.slugService.generateUniqueSlug(tName, tagId, "tag");
          const savedTag = await this.tagRepo.save({
            id: tagId,
            title: typeof t.title === "object" ? t.title : { ru: tName, en: tName },
            slug: tagSlug
          });
          tagsList.push(savedTag.id);
        }
      }
    } else {
      // Keep existing tags if updating without modifying tags
      const existing = await this.categoryRepo.getById(id);
      if (existing && existing.tags) {
        tagsList = existing.tags.map((t: any) => typeof t === "string" ? t : t.id);
      }
    }

    const category: Category = {
      id,
      title: typeof body.title === "string" ? { ru: body.title, en: "" } : { ru: body.title?.ru || "", en: body.title?.en || "" },
      description: typeof body.description === "string" ? { ru: body.description, en: "" } : { ru: body.description?.ru || "", en: body.description?.en || "" },
      order: body.order ?? categories.length + 1,
      parentId: body.parentId || (body.parent ? (typeof body.parent === "string" ? body.parent : body.parent.id) : undefined),
      colorId: colorVal,
      collectionId: body.collectionId || (body.collection ? (typeof body.collection === "string" ? body.collection : body.collection.id) : "all"),
      tagsIds: tagsList,
      slug,
    };

    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<boolean> {
    await this.slugService.deleteSlugForEntity(id, "category");
    return this.categoryRepo.delete(id);
  }
}


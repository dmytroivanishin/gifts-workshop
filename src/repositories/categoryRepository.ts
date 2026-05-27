import { BaseRepository, registerRepository, populateRelations, repositoryRegistry } from "./baseRepository";
import { ICategoryRepository, ICollectionRepository } from "./interfaces";
import { Category, PopulatedCategory, Tag } from "@/types";
import { NotFoundError } from "@/common/errors/notFound";
import { ValidationError } from "@/common/errors/validation";

export class CategoryRepository extends BaseRepository<Category, PopulatedCategory> implements ICategoryRepository {
  constructor() {
    super("categories");
    registerRepository("categories", this);
  }

  async getBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedCategory | undefined> {
    const recs = await this.getByQuery({ slug }, options);
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }

  protected override async populate(cat: Category, options?: { populate?: string }): Promise<PopulatedCategory> {
    const res = await this.populateMany([cat], options);
    return res[0];
  }

  protected override async populateMany(cats: Category[], options?: { populate?: string }): Promise<PopulatedCategory[]> {
    return populateRelations<Category, PopulatedCategory>(
      cats,
      options?.populate,
      {
        color: {
          repoName: "colors",
          idExtractor: c => c.colorId,
          mapper: (cat, colors) => {
            cat.color = colors.find(c => c.id === cat.colorId);
          }
        },
        collection: {
          repoName: "collections",
          idExtractor: c => c.collectionId,
          mapper: (cat, collections) => {
            cat.collection = collections.find(c => c.id === cat.collectionId)!;
          }
        },
        tags: {
          repoName: "tags",
          idExtractor: c => c.tagsIds,
          mapper: (cat, tags) => {
            cat.tags = (cat.tagsIds || []).map(tid => tags.find(t => t.id === tid)).filter((t): t is Tag => !!t);
          }
        }
      }
    ).then(populatedCats => {
      // Resolve self-referential parent category from the loaded array
      return populatedCats.map(cat => {
        cat.parent = cat.parentId ? populatedCats.find(c => c.id === cat.parentId) : undefined;
        return cat;
      });
    });
  }

  async save(item: any): Promise<PopulatedCategory> {
    const collectionRepo = repositoryRegistry["collections"] as ICollectionRepository;
    const collectionId = item.collectionId;

    if (!collectionId) {
      throw new ValidationError("Collection is required to save a category", [
        { field: "collectionId", message: "Collection is required" }
      ]);
    }

    if (collectionRepo) {
      const collection = await collectionRepo.getById(collectionId);
      if (!collection) {
        throw new NotFoundError(`Collection with ID ${collectionId} not found`);
      }
    }

    return super.save(item);
  }

  protected serialize(item: any): Category {
    const raw: any = { ...item };

    const colorId = raw.colorId;
    const collectionId = raw.collectionId;
    const parentId = raw.parentId;
    const tagsIds = raw.tagsIds || [];

    delete raw.color;
    delete raw.collection;
    delete raw.parent;
    delete raw.tags;

    return {
      ...raw,
      colorId,
      collectionId,
      parentId,
      tagsIds,
    };
  }
}

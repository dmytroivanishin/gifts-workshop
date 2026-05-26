import { BaseRepository, registerRepository, repositoryRegistry } from "./baseRepository";
import { randomUUID } from "crypto";
import { IPostRepository, QueryOptions } from "./interfaces";
import { Post, PopulatedPost, Tag, PostMedia, PopulatedPostMedia, PopulatedCategory } from "@/types";
import { NotFoundError } from "@/common/errors/notFound";
import { InternalServerError } from "@/common/errors/internalServer";

export class PostRepository extends BaseRepository<Post, PopulatedPost> implements IPostRepository {
  constructor() {
    super("posts");
    registerRepository("posts", this);
  }

  async getBySlug(slug: string): Promise<PopulatedPost | undefined> {
    const recs = await this.getByQuery({ slug });
    if (!recs || recs.length === 0) return undefined;
    return recs[0];
  }

  override async getAll(options?: QueryOptions): Promise<PopulatedPost[]> {
    const params = new URLSearchParams();

    if (options) {
      const { search, categoryId, collectionId, tagsIds, slug, inStock, status } = options;

      if (status) params.append("status", status);
      if (inStock !== undefined) params.append("in_stock", inStock.toString());
      if (categoryId) params.append("categoryId", categoryId);
      if (collectionId) params.append("collectionId", collectionId);
      if (slug) params.append("slug", slug);
      if (tagsIds) params.append("tagsIds", tagsIds);
      if (search) params.append("q", search);
    }

    if (options?.page || options?.limit) {
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      params.append("_page", page.toString());
      params.append("_limit", limit.toString());
    }

    const queryString = params.toString();
    const url = `${this.getUrl()}${queryString ? `?${queryString}` : ""}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new InternalServerError(`Failed to fetch posts`);
    }

    const json = await res.json();
    const rawItems: Post[] = Array.isArray(json) ? json : json.data || [];
    return Promise.all(rawItems.map(item => this.populate(item)));
  }

  protected async populate(post: Post): Promise<PopulatedPost> {
    const categoryRepo = repositoryRegistry["categories"];
    const collectionRepo = repositoryRegistry["collections"];
    const tagRepo = repositoryRegistry["tags"];
    const mediaRepo = repositoryRegistry["media"];

    // 1. Resolve collection
    let collection = undefined;
    if (post.collectionId && collectionRepo) {
      collection = await collectionRepo.getById(post.collectionId);
    }
    if (!collection) {
      throw new NotFoundError(`Collection with ID ${post.collectionId} not found for post ${post.id}`);
    }

    // 2. Resolve category
    let category = undefined;
    if (post.categoryId && categoryRepo) {
      category = await categoryRepo.getById(post.categoryId) as PopulatedCategory;
    }
    if (!category) {
      throw new NotFoundError(`Category with ID ${post.categoryId} not found for post ${post.id}`);
    }

    // 3. Resolve tags
    const tags = (post.tagsIds && tagRepo)
      ? (await Promise.all(post.tagsIds.map(tagId => tagRepo.getById(tagId)))).filter((t): t is Tag => !!t)
      : [];

    // 4. Resolve poster
    let poster = undefined;
    let posterMediaId = undefined;
    if (post.posterId) {
      if (typeof post.posterId === "string") {
        posterMediaId = post.posterId;
      } else if (typeof post.posterId === "object" && (post.posterId as any).media) {
        posterMediaId = (post.posterId as any).media;
      }
    }

    if (posterMediaId && mediaRepo) {
      poster = await mediaRepo.getById(posterMediaId);
    }

    // 5. Resolve media array
    const mediaList = (post.media && mediaRepo)
      ? (await Promise.all(
        post.media.map(async (m): Promise<PopulatedPostMedia | null> => {
          const mediaItem = await mediaRepo.getById(m.mediaId);
          if (!mediaItem) return null;
          return {
            id: m.id,
            order: m.order,
            mediaId: m.mediaId,
            position: m.position,
            media: mediaItem,
          };
        })
      )).filter((m): m is PopulatedPostMedia => !!m)
      : [];

    if (mediaList.length === 0 && poster && posterMediaId) {
      mediaList.push({
        id: `m-fallback-${post.id}`,
        order: 1,
        mediaId: posterMediaId,
        position: typeof post.posterId === "object" ? (post.posterId as any).position : undefined,
        media: poster,
      });
    }

    return {
      ...post,
      collection,
      category,
      tags,
      poster,
      media: mediaList,
    };
  }

  protected serialize(item: any): Post {
    const raw = { ...item };

    // Extricate IDs from relation fields
    const categoryId = raw.categoryId || (raw.category ? (typeof raw.category === "string" ? raw.category : raw.category.id) : "");
    const collectionId = raw.collectionId || (raw.collection ? (typeof raw.collection === "string" ? raw.collection : raw.collection.id) : "all");
    const posterId = raw.posterId || (raw.poster ? (typeof raw.poster === "string" ? raw.poster : raw.poster.id) : undefined);

    let tagsIds = raw.tagsIds;
    if (Array.isArray(raw.tags)) {
      tagsIds = raw.tags.map((t: any) => typeof t === "string" ? t : t.id);
    }

    const flatMedia: PostMedia[] = Array.isArray(raw.media)
      ? raw.media
        .map((pm: any): PostMedia | null => {
          const mediaId = pm.mediaId || (pm.media ? pm.media.id : undefined);
          if (!mediaId) return null;
          return {
            id: pm.id || randomUUID(),
            order: pm.order || 0,
            mediaId,
            position: pm.position,
          };
        })
        .filter((m: PostMedia | null): m is PostMedia => !!m)
      : [];

    // Strip relations
    delete raw.category;
    delete raw.collection;
    delete raw.tags;
    delete raw.poster;

    return {
      ...raw,
      categoryId,
      collectionId,
      posterId,
      tagsIds,
      media: flatMedia,
    };
  }
}

import { BaseRepository, registerRepository, populateRelations } from "./baseRepository";
import { randomUUID } from "crypto";
import { IPostRepository, QueryOptions } from "./interfaces";
import { Post, PopulatedPost, Tag, PostMedia } from "@/types";
import { NotFoundError } from "@/common/errors/notFound";
import { InternalServerError } from "@/common/errors/internalServer";

export class PostRepository extends BaseRepository<Post, PopulatedPost> implements IPostRepository {
  constructor() {
    super("posts");
    registerRepository("posts", this);
  }

  async getBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedPost | undefined> {
    const recs = await this.getByQuery({ slug }, options);
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
    return this.populateMany(rawItems, options);
  }

  protected override async populate(post: Post, options?: { populate?: string }): Promise<PopulatedPost> {
    const res = await this.populateMany([post], options);
    return res[0];
  }

  protected override async populateMany(posts: Post[], options?: { populate?: string }): Promise<PopulatedPost[]> {
    return populateRelations<Post, PopulatedPost>(
      posts,
      options?.populate,
      {
        category: {
          repoName: "categories",
          idExtractor: p => p.categoryId,
          mapper: (post, categories) => {
            post.category = categories.find(c => c.id === post.categoryId) as any;
          }
        },
        collection: {
          repoName: "collections",
          idExtractor: p => p.collectionId,
          mapper: (post, collections) => {
            post.collection = collections.find(c => c.id === post.collectionId);
          }
        },
        tags: {
          repoName: "tags",
          idExtractor: p => p.tagsIds,
          mapper: (post, tags) => {
            post.tags = (post.tagsIds || []).map(tid => tags.find(t => t.id === tid)).filter((t): t is Tag => !!t);
          }
        },
        poster: {
          repoName: "media",
          idExtractor: p => p.posterId,
          mapper: (post, media) => {
            post.poster = media.find(m => m.id === post.posterId);
          }
        },
        media: {
          repoName: "media",
          idExtractor: p => (p.media || []).map(m => m.mediaId),
          mapper: (post, media) => {
            post.media = (post.media || [])
              .map(m => {
                const med = media.find(item => item.id === m.mediaId);
                return med ? { ...m, media: med } : null;
              })
              .filter((m): m is any => !!m);
          }
        }
      }
    );
  }

  protected serialize(item: any): Post {
    const raw = { ...item };

    const categoryId = raw.categoryId;
    const collectionId = raw.collectionId;
    const posterId = raw.posterId;
    const tagsIds = raw.tagsIds || [];

    const flatMedia: PostMedia[] = Array.isArray(raw.media)
      ? raw.media
        .map((pm: any): PostMedia => ({
          id: pm.id || randomUUID(),
          order: pm.order || 0,
          mediaId: pm.mediaId || pm.media?.id,
          position: pm.position,
        }))
        .filter((m: PostMedia) => !!m.mediaId)
      : [];

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


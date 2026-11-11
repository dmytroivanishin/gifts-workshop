import type { Post, PopulatedPost, PaginationOptions } from "@/types";
import type { QueryOptions } from "../query";
import type { IBaseRepository } from "./base";

export interface IPostRepository extends IBaseRepository<Post, PopulatedPost, QueryOptions> {
  getBySlug(slug: string): Promise<PopulatedPost | undefined>;
  getByQuery(query: QueryOptions, options?: PaginationOptions): Promise<PopulatedPost[]>;
  countByCategory(categoryId: string): Promise<number>;
  countByPoster(mediaId: string): Promise<number>;
  countGalleryUsage(mediaId: string): Promise<number>;
  // Batched version of countByPoster/countGalleryUsage for the bulk-delete path: one query each
  // across every requested id, instead of two queries per id in a loop.
  findUsedMediaIds(mediaIds: string[]): Promise<Set<string>>;
  deleteMany(ids: string[]): Promise<string[]>;
}

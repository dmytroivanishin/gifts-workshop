import { Category, PopulatedCategory, Collection, Color, Media, Post, PopulatedPost, Tag, User, PaginationOptions } from "@/types";

export interface QueryOptions extends PaginationOptions {
  search?: string;
  category?: string;
  tag?: string;
  inStock?: boolean;
  status?: string;
  collectionSlug?: string;
  postSlug?: string;
  
  // Database-native flat fields for repository querying
  categoryId?: string;
  collectionId?: string;
  tagsIds?: string;
  slug?: string;
  populate?: string;
}

export interface IBaseRepository<T, TPopulated = T, TQueryOptions = PaginationOptions> {
  getAll(options?: TQueryOptions & { populate?: string }): Promise<TPopulated[]>;
  getById(id: string, options?: { populate?: string }): Promise<TPopulated | undefined>;
  getByIds(ids: string[], options?: { populate?: string }): Promise<TPopulated[]>;
  save(item: T): Promise<TPopulated>;
  delete(id: string): Promise<boolean>;
}

export interface ICategoryRepository extends IBaseRepository<Category, PopulatedCategory> {
  getBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedCategory | undefined>;
}

export interface ICollectionRepository extends IBaseRepository<Collection> {
  getBySlug(slug: string): Promise<Collection | undefined>;
}

export interface IColorRepository extends IBaseRepository<Color> {}

export interface IMediaRepository extends IBaseRepository<Media> {}

export interface IPostRepository extends IBaseRepository<Post, PopulatedPost, QueryOptions> {
  getBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedPost | undefined>;
  getByQuery(query: Record<string, any>, options?: PaginationOptions & { populate?: string }): Promise<PopulatedPost[]>;
}

export interface ITagRepository extends IBaseRepository<Tag> {
  getBySlug(slug: string): Promise<Tag | undefined>;
}

export interface IUserRepository extends IBaseRepository<User> {
  getByEmail(email: string): Promise<User | undefined>;
}

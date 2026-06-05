import { Category, PopulatedCategory, Collection, Color, Media, Post, PopulatedPost, Tag, User, PaginationOptions, Language, SystemText, Comment, PopulatedComment } from "@/types";

export interface QueryOptions extends PaginationOptions {
  search?: string;
  category?: string;
  tag?: string;
  collection?: string;
  post?: string;
  inStock?: boolean;
  status?: string;
  postId?: string;
  
  // Database-native flat fields for repository querying
  id?: string;
  categoryId?: string | string[];
  collectionId?: string;
  tagsIds?: string;
  slug?: string;
  area?: string;
}

export interface IBaseRepository<T, TPopulated = T, TQueryOptions = PaginationOptions> {
  getAll(options?: TQueryOptions): Promise<TPopulated[]>;
  getById(id: string): Promise<TPopulated | undefined>;
  getByIds(ids: string[]): Promise<TPopulated[]>;
  save(item: T): Promise<TPopulated>;
  saveMany(items: T[]): Promise<TPopulated[]>;
  delete(id: string): Promise<boolean>;
}

export interface ICategoryRepository extends IBaseRepository<Category, PopulatedCategory> {
  getBySlug(slug: string): Promise<PopulatedCategory | undefined>;
  updateColorInCategories(colorId: string, newHex: string): Promise<void>;
  reorderCategories(items: { id: string; order: number }[]): Promise<boolean>;
}

export interface ICollectionRepository extends IBaseRepository<Collection> {
  getBySlug(slug: string): Promise<Collection | undefined>;
}

export interface IColorRepository extends IBaseRepository<Color> {}

export interface IMediaRepository extends IBaseRepository<Media> {}

export interface IPostRepository extends IBaseRepository<Post, PopulatedPost, QueryOptions> {
  getBySlug(slug: string): Promise<PopulatedPost | undefined>;
  getByQuery(query: Record<string, any>, options?: PaginationOptions): Promise<PopulatedPost[]>;
}

export interface ITagRepository extends IBaseRepository<Tag> {
  getBySlug(slug: string): Promise<Tag | undefined>;
}

export interface IUserRepository extends IBaseRepository<User> {
  getByEmail(email: string): Promise<User | undefined>;
}

export interface ILanguageRepository extends IBaseRepository<Language> {
  getByCode(code: string): Promise<Language | undefined>;
}

export interface ISystemTextRepository extends IBaseRepository<SystemText, SystemText, QueryOptions> {}

export interface ICommentRepository extends IBaseRepository<Comment, PopulatedComment, QueryOptions> {
  getByQuery(query: Record<string, any>, options?: PaginationOptions): Promise<PopulatedComment[]>;
}


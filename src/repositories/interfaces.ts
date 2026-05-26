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
}

export interface ICategoryRepository {
  getAll(options?: PaginationOptions): Promise<PopulatedCategory[]>;
  getById(id: string): Promise<PopulatedCategory | undefined>;
  getBySlug(slug: string): Promise<PopulatedCategory | undefined>;
  save(category: Category): Promise<PopulatedCategory>;
  delete(id: string): Promise<boolean>;
}

export interface ICollectionRepository {
  getAll(options?: PaginationOptions): Promise<Collection[]>;
  getById(id: string): Promise<Collection | undefined>;
  getBySlug(slug: string): Promise<Collection | undefined>;
  save(collection: Collection): Promise<Collection>;
  delete(id: string): Promise<boolean>;
}

export interface IColorRepository {
  getAll(options?: PaginationOptions): Promise<Color[]>;
  getById(id: string): Promise<Color | undefined>;
  save(color: Color): Promise<Color>;
  delete(id: string): Promise<boolean>;
}

export interface IMediaRepository {
  getAll(options?: PaginationOptions): Promise<Media[]>;
  getById(id: string): Promise<Media | undefined>;
  save(media: Media): Promise<Media>;
  delete(id: string): Promise<boolean>;
}

export interface IPostRepository {
  getAll(options?: QueryOptions): Promise<PopulatedPost[]>;
  getById(id: string): Promise<PopulatedPost | undefined>;
  getBySlug(slug: string): Promise<PopulatedPost | undefined>;
  save(post: Post): Promise<PopulatedPost>;
  delete(id: string): Promise<boolean>;
  getByQuery(query: Record<string, any>, options?: PaginationOptions): Promise<PopulatedPost[]>;
}

export interface ITagRepository {
  getAll(options?: PaginationOptions): Promise<Tag[]>;
  getById(id: string): Promise<Tag | undefined>;
  getBySlug(slug: string): Promise<Tag | undefined>;
  save(tag: Tag): Promise<Tag>;
  delete(id: string): Promise<boolean>;
}

export interface IUserRepository {
  getAll(options?: PaginationOptions): Promise<User[]>;
  getById(id: string): Promise<User | undefined>;
  getByEmail(email: string): Promise<User | undefined>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<boolean>;
}

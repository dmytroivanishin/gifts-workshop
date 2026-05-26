import { Category, Collection, Color, Media, Post, Tag, User, PaginatedResult, PaginationOptions } from "@/types";


export interface QueryOptions extends PaginationOptions {
  search?: string;
  category?: string;
  tag?: string;
  inStock?: boolean;
  status?: string;
  collectionSlug?: string;
  postSlug?: string;
}

export interface ICategoryRepository {
  getAll(options?: PaginationOptions): Promise<Category[]>;
  getById(id: string): Promise<Category | undefined>;
  getBySlug(slug: string): Promise<Category | undefined>;
  save(category: Category): Promise<Category>;
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
  getAll(options?: QueryOptions): Promise<Post[]>;
  getById(id: string): Promise<Post | undefined>;
  getBySlug(slug: string): Promise<Post | undefined>;
  save(post: Post): Promise<Post>;
  delete(id: string): Promise<boolean>;
  getByQuery(query: Record<string, any>, options?: PaginationOptions): Promise<Post[]>;
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


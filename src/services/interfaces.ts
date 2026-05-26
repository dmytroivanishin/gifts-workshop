import { Category, Collection, Color, Media, Post, Tag, User, PaginatedResult, PaginationOptions } from "@/types";

export type Slug = any;
export type Localization = any;

import { QueryOptions } from "@/repositories/interfaces";

export interface ICategoryService {
  getAllCategories(options?: PaginationOptions): Promise<PaginatedResult<Category>>;
  getCategoryById(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  saveCategory(body: any): Promise<Category>;
  deleteCategory(id: string): Promise<boolean>;
}

export interface ICollectionService {
  getAllCollections(options?: PaginationOptions): Promise<PaginatedResult<Collection>>;
  getCollectionById(id: string): Promise<Collection | undefined>;
  getCollectionBySlug(slug: string): Promise<Collection | undefined>;
  saveCollection(body: any): Promise<Collection>;
  deleteCollection(id: string): Promise<boolean>;
}

export interface IColorService {
  getAllColors(options?: PaginationOptions): Promise<PaginatedResult<Color>>;
  getColorById(id: string): Promise<Color | undefined>;
  saveColor(body: any): Promise<Color>;
  deleteColor(id: string): Promise<boolean>;
}

export interface ILocalizationService {
  getAllLocalizations(options?: PaginationOptions): Promise<PaginatedResult<Localization>>;
  getLocalizationById(id: string): Promise<Localization | undefined>;
  getByEntity(entityId: string, entityType: string): Promise<Localization[]>;
  saveLocalization(body: any): Promise<Localization>;
  deleteLocalization(id: string): Promise<boolean>;
}

export interface IMediaService {
  getAllMedia(options?: PaginationOptions): Promise<PaginatedResult<Media>>;
  getMediaById(id: string): Promise<Media | undefined>;
  saveMedia(body: any): Promise<Media>;
  deleteMedia(id: string): Promise<boolean>;
}

export interface ISlugService {
  getAllSlugs(options?: PaginationOptions): Promise<PaginatedResult<Slug>>;
  getSlugById(id: string): Promise<Slug | undefined>;
  getSlugByName(name: string): Promise<Slug | undefined>;
  generateUniqueSlug(titleInput: any, entityId: string, entityType: "post" | "category" | "collection" | "tag"): Promise<string>;
  deleteSlugForEntity(entityId: string, entityType: "post" | "category" | "collection" | "tag"): Promise<boolean>;
}

export interface ITagService {
  getAllTags(options?: PaginationOptions): Promise<PaginatedResult<Tag>>;
  getTagById(id: string): Promise<Tag | undefined>;
  getTagBySlug(slug: string): Promise<Tag | undefined>;
  saveTag(body: any): Promise<Tag>;
  deleteTag(id: string): Promise<boolean>;
}

export interface IUserService {
  getAllUsers(options?: PaginationOptions): Promise<PaginatedResult<User>>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  saveUser(body: any): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
}

export interface IPostService {
  getFilteredPosts(filters?: QueryOptions): Promise<PaginatedResult<Post>>;
  getPostById(id: string): Promise<Post | undefined>;
  getPostBySlug(slug: string): Promise<Post | undefined>;
  createPost(body: any): Promise<Post>;
  updatePost(id: string, body: any): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
}


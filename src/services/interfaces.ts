import { Category, Collection, Color, Media, Post, Tag, User, PaginatedResult, PaginationOptions, Language, SystemText, Comment, PopulatedCategory } from "@/types";

import { QueryOptions } from "@/repositories/interfaces";

export interface ICategoryService {
  getAllCategories(options?: PaginationOptions & { populate?: string }): Promise<PaginatedResult<Category>>;
  getCategoryById(id: string, options?: { populate?: string }): Promise<PopulatedCategory | undefined>;
  getCategoryBySlug(slug: string, options?: { populate?: string }): Promise<PopulatedCategory | undefined>;
  saveCategory(category: any): Promise<PopulatedCategory>;
  deleteCategory(id: string): Promise<boolean>;
  reorderCategories(items: { id: string; order: number }[]): Promise<boolean>;
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

export interface IMediaService {
  getAllMedia(options?: PaginationOptions): Promise<PaginatedResult<Media>>;
  getMediaById(id: string): Promise<Media | undefined>;
  saveMedia(body: any): Promise<Media>;
  uploadAndSaveMedia(buffer: Buffer, originalFilename: string, mimeType: string, userId: string): Promise<Media>;
  uploadMultiple(files: File[], userId: string): Promise<Media[]>;
  deleteMedia(id: string): Promise<boolean>;
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
  getPostById(id: string, options?: { populate?: string }): Promise<Post | undefined>;
  getPostBySlug(slug: string, options?: { populate?: string }): Promise<Post | undefined>;
  createPost(body: any): Promise<Post>;
  updatePost(id: string, body: any): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
}

export interface ILanguageService {
  getAllLanguages(options?: PaginationOptions): Promise<PaginatedResult<Language>>;
  getLanguageById(id: string): Promise<Language | undefined>;
  getLanguageByCode(code: string): Promise<Language | undefined>;
  saveLanguage(body: any): Promise<Language>;
  deleteLanguage(id: string): Promise<boolean>;
}

export interface ISystemTextService {
  getAllSystemTexts(options?: PaginationOptions): Promise<PaginatedResult<SystemText>>;
  getSystemTextById(id: string): Promise<SystemText | undefined>;
  saveSystemText(body: any): Promise<SystemText>;
  deleteSystemText(id: string): Promise<boolean>;
}

export interface ICommentService {
  getFilteredComments(filters?: QueryOptions): Promise<PaginatedResult<Comment>>;
  getCommentById(id: string, options?: { populate?: string }): Promise<Comment | undefined>;
  createComment(body: any): Promise<Comment>;
  updateCommentStatus(id: string, status: "Review" | "Approved" | "Rejected"): Promise<Comment | undefined>;
  replyToComment(id: string, body: any): Promise<Comment>;
  deleteComment(id: string): Promise<boolean>;
}

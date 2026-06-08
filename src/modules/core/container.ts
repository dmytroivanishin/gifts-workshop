import { drizzleDatabase } from "@/repositories/drizzle/database";
import { initializeBucket } from "@/modules/storage/minioClient";

// Initialize PostgreSQL connection using Drizzle
const dbUri = process.env.DB_URI;
if (dbUri) {
  drizzleDatabase.connect(dbUri).catch(err => {
    console.error("❌ Failed to connect to PostgreSQL in container initialization:", err);
  });
} else {
  console.warn("⚠️ DB_URI is not set in environment.");
}

// Initialize MinIO Bucket
initializeBucket().catch(err => {
  console.error("❌ Failed to initialize MinIO Bucket:", err);
});

import { categoryRepository } from "@/repositories/drizzle/categoryRepository";
import { collectionRepository } from "@/repositories/drizzle/collectionRepository";
import { colorRepository } from "@/repositories/drizzle/colorRepository";
import { mediaRepository } from "@/repositories/drizzle/mediaRepository";
import { postRepository } from "@/repositories/drizzle/postRepository";
import { tagRepository } from "@/repositories/drizzle/tagRepository";
import { userRepository } from "@/repositories/drizzle/userRepository";
import { systemTextRepository } from "@/repositories/drizzle/systemTextRepository";
import { commentRepository } from "@/repositories/drizzle/commentRepository";

import { CategoryService } from "@/services/categoryService";
import { CollectionService } from "@/services/collectionService";
import { ColorService } from "@/services/colorService";
import { MediaService } from "@/services/mediaService";
import { PostService } from "@/services/postService";
import { TagService } from "@/services/tagService";
import { UserService } from "@/services/userService";
import { SystemTextService } from "@/services/systemTextService";
import { CommentService } from "@/services/commentService";

import { CategoryController } from "@/controllers/categoryController";
import { CollectionController } from "@/controllers/collectionController";
import { ColorController } from "@/controllers/colorController";
import { MediaController } from "@/controllers/mediaController";
import { PostController } from "@/controllers/postController";
import { TagController } from "@/controllers/tagController";
import { UserController } from "@/controllers/userController";
import { SystemTextController } from "@/controllers/systemTextController";
import { CommentController } from "@/controllers/commentController";

// 1. Repositories are imported directly as singletons from the Drizzle domain layer
export {
  categoryRepository,
  collectionRepository,
  colorRepository,
  mediaRepository,
  postRepository,
  tagRepository,
  userRepository,
  systemTextRepository,
  commentRepository
};

// 2. Instantiating Services and injecting repository/service dependencies
export const colorService = new ColorService(colorRepository, categoryRepository);
export const categoryService = new CategoryService(categoryRepository, tagRepository);
export const collectionService = new CollectionService(collectionRepository);
export const mediaService = new MediaService(mediaRepository, postRepository);
export const tagService = new TagService(tagRepository, categoryRepository);
export const userService = new UserService(userRepository);
export const postService = new PostService(postRepository, categoryRepository, tagRepository, collectionRepository);
export const systemTextService = new SystemTextService(systemTextRepository);
export const commentService = new CommentService(commentRepository);

// 3. Instantiating Controllers and injecting service dependencies
export const categoryController = new CategoryController(categoryService);
export const collectionController = new CollectionController(collectionService);
export const colorController = new ColorController(colorService);
export const mediaController = new MediaController(mediaService);
export const postController = new PostController(postService);
export const tagController = new TagController(tagService);
export const userController = new UserController(userService);
export const systemTextController = new SystemTextController(systemTextService);
export const commentController = new CommentController(commentService);


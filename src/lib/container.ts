import { Database } from "@/repositories/baseRepository";

// Initialize Database connection using environment variables
const dbUri = process.env.DB_URI || "http://localhost";
const dbPort = process.env.DB_PORT || 3001;
const dbName = process.env.DB_NAME || "portfolio";
const dbUser = process.env.DB_USER || "";
const dbPassword = process.env.DB_PASSWORD || "";

Database.connect(dbUri, {
  port: dbPort,
  dbName,
  user: dbUser,
  password: dbPassword
});

import { CategoryRepository } from "@/repositories/categoryRepository";
import { CollectionRepository } from "@/repositories/collectionRepository";
import { ColorRepository } from "@/repositories/colorRepository";
import { MediaRepository } from "@/repositories/mediaRepository";
import { PostRepository } from "@/repositories/postRepository";
import { TagRepository } from "@/repositories/tagRepository";
import { UserRepository } from "@/repositories/userRepository";

import { CategoryService } from "@/services/categoryService";
import { CollectionService } from "@/services/collectionService";
import { ColorService } from "@/services/colorService";
import { MediaService } from "@/services/mediaService";
import { PostService } from "@/services/postService";
import { TagService } from "@/services/tagService";
import { UserService } from "@/services/userService";

import { CategoryController } from "@/controllers/categoryController";
import { CollectionController } from "@/controllers/collectionController";
import { ColorController } from "@/controllers/colorController";
import { MediaController } from "@/controllers/mediaController";
import { PostController } from "@/controllers/postController";
import { TagController } from "@/controllers/tagController";
import { UserController } from "@/controllers/userController";

// 1. Instantiating Repositories
export const categoryRepository = new CategoryRepository();
export const collectionRepository = new CollectionRepository();
export const colorRepository = new ColorRepository();
export const mediaRepository = new MediaRepository();
export const postRepository = new PostRepository();
export const tagRepository = new TagRepository();
export const userRepository = new UserRepository();

// 2. Instantiating Services and injecting repository/service dependencies
export const colorService = new ColorService(colorRepository, categoryRepository);
export const categoryService = new CategoryService(categoryRepository, tagRepository);
export const collectionService = new CollectionService(collectionRepository);
export const mediaService = new MediaService(mediaRepository, postRepository);
export const tagService = new TagService(tagRepository, categoryRepository);
export const userService = new UserService(userRepository);
export const postService = new PostService(postRepository, categoryRepository, tagRepository, collectionRepository);

// 3. Instantiating Controllers and injecting service dependencies
export const categoryController = new CategoryController(categoryService);
export const collectionController = new CollectionController(collectionService);
export const colorController = new ColorController(colorService);
export const mediaController = new MediaController(mediaService);
export const postController = new PostController(postService);
export const tagController = new TagController(tagService);
export const userController = new UserController(userService);

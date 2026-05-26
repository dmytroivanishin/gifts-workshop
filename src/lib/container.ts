import { CategoryRepository } from "@/repositories/categoryRepository";
import { CollectionRepository } from "@/repositories/collectionRepository";
import { ColorRepository } from "@/repositories/colorRepository";
import { LocalizationRepository } from "@/repositories/localizationRepository";
import { MediaRepository } from "@/repositories/mediaRepository";
import { PostRepository } from "@/repositories/postRepository";
import { SlugRepository } from "@/repositories/slugRepository";
import { TagRepository } from "@/repositories/tagRepository";
import { UserRepository } from "@/repositories/userRepository";

import { SlugService } from "@/services/slugService";
import { CategoryService } from "@/services/categoryService";
import { CollectionService } from "@/services/collectionService";
import { ColorService } from "@/services/colorService";
import { LocalizationService } from "@/services/localizationService";
import { MediaService } from "@/services/mediaService";
import { PostService } from "@/services/postService";
import { TagService } from "@/services/tagService";
import { UserService } from "@/services/userService";

import { CategoryController } from "@/controllers/categoryController";
import { CollectionController } from "@/controllers/collectionController";
import { ColorController } from "@/controllers/colorController";
import { LocalizationController } from "@/controllers/localizationController";
import { MediaController } from "@/controllers/mediaController";
import { PostController } from "@/controllers/postController";
import { SlugController } from "@/controllers/slugController";
import { TagController } from "@/controllers/tagController";
import { UserController } from "@/controllers/userController";

// 1. Instantiating Repositories
export const categoryRepository = new CategoryRepository();
export const collectionRepository = new CollectionRepository();
export const colorRepository = new ColorRepository();
export const localizationRepository = new LocalizationRepository();
export const mediaRepository = new MediaRepository();
export const postRepository = new PostRepository();
export const slugRepository = new SlugRepository();
export const tagRepository = new TagRepository();
export const userRepository = new UserRepository();

// 2. Instantiating Services and injecting repository/service dependencies
export const slugService = new SlugService(slugRepository);
export const colorService = new ColorService(colorRepository);
export const categoryService = new CategoryService(categoryRepository, slugService, colorRepository, tagRepository);
export const collectionService = new CollectionService(collectionRepository, slugService);
export const localizationService = new LocalizationService(localizationRepository);
export const mediaService = new MediaService(mediaRepository, postRepository);
export const tagService = new TagService(tagRepository, slugService);
export const userService = new UserService(userRepository);
export const postService = new PostService(postRepository, categoryRepository, tagRepository, collectionRepository, slugService);

// 3. Instantiating Controllers and injecting service dependencies
export const categoryController = new CategoryController(categoryService);
export const collectionController = new CollectionController(collectionService);
export const colorController = new ColorController(colorService);
export const localizationController = new LocalizationController(localizationService);
export const mediaController = new MediaController(mediaService);
export const postController = new PostController(postService);
export const slugController = new SlugController(slugService);
export const tagController = new TagController(tagService);
export const userController = new UserController(userService);

import { readFileSync } from "node:fs";
import path from "node:path";

import type { Category, Collection, Color, Page, SystemText, Tag, User } from "@/types";
import { categoryRepository } from "@/repositories/drizzle/categoryRepository";
import { collectionRepository } from "@/repositories/drizzle/collectionRepository";
import { colorRepository } from "@/repositories/drizzle/colorRepository";
import { pageRepository } from "@/repositories/drizzle/pageRepository";
import { systemTextRepository } from "@/repositories/drizzle/systemTextRepository";
import { tagRepository } from "@/repositories/drizzle/tagRepository";
import { userRepository } from "@/repositories/drizzle/userRepository";

// Initial content, loaded once by migrate.ts. Order matters: users first (every row points at
// one), then colours, tags and collections, categories (they reference all of those), pages,
// and system texts last (no foreign keys).

const DATA_DIR = path.join(__dirname, "data");

interface CategoryTagLink {
  readonly categoryId: string;
  readonly tagId: string;
}

function readData<T>(fileName: string): T[] {
  return JSON.parse(readFileSync(path.join(DATA_DIR, fileName), "utf8")) as T[];
}

async function seedCategories(): Promise<void> {
  // categories_to_tags is not a table of its own in the seed: the repository's saveMany takes
  // each category's tagsIds and rewrites its links, so the join rows are grouped here first.
  const links = readData<CategoryTagLink>("categories_to_tags.json");
  const tagsByCategory = new Map<string, string[]>();
  for (const link of links) {
    const tagIds = tagsByCategory.get(link.categoryId) ?? [];
    tagIds.push(link.tagId);
    tagsByCategory.set(link.categoryId, tagIds);
  }
  const categories = readData<Category>("categories.json").map((category) => ({
    ...category,
    tagsIds: tagsByCategory.get(category.id) ?? [],
  }));
  await categoryRepository.saveMany(categories);
}

export async function seed(): Promise<void> {
  await userRepository.saveMany(readData<User>("users.json"));
  await colorRepository.saveMany(readData<Color>("colors.json"));
  await tagRepository.saveMany(readData<Tag>("tags.json"));
  await collectionRepository.saveMany(readData<Collection>("collections.json"));
  await seedCategories();
  await pageRepository.saveMany(readData<Page>("pages.json"));
  await systemTextRepository.saveMany(readData<SystemText>("system-texts.json"));
}

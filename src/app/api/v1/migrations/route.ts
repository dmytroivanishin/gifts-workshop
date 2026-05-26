import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  userRepository,
  colorRepository,
  collectionRepository,
  categoryRepository,
  tagRepository,
  postRepository,
} from "@/lib/container";
import seedUser from "@/migrations/initial-data/users.json";
import seedColors from "@/migrations/initial-data/colors.json";
import seedCollection from "@/migrations/initial-data/collections.json";
import seedCategories from "@/migrations/initial-data/categories.json";
import seedTags from "@/migrations/initial-data/tags.json";
import seedPosts from "@/migrations/initial-data/posts.json";

const DB_PATH = path.join(process.cwd(), "src/data/db.json");

export async function GET() {
  try {
    console.log("🚀 Starting database migration via Next.js API...");

    // Set migration env variable programmatically
    process.env.MIGRATION = "true";

    // 1. Clear database completely to prevent duplicate/stale records with old IDs
    console.log("🧹 Resetting db.json contents...");
    await fs.writeFile(DB_PATH, JSON.stringify({
      posts: [],
      categories: [],
      collections: [],
      colors: [],
      tags: [],
      slugs: [],
      media: [],
      users: [],
      localizations: [],
    }, null, 2), "utf-8");

    // 2. Migrate User
    console.log("👤 Migrating User entity...");
    if (seedUser && seedUser.length > 0) {
      await userRepository.save(seedUser[0]);
    }

    // 3. Migrate Colors
    console.log("🎨 Migrating Color entities...");
    for (const color of seedColors) {
      await colorRepository.save(color as any);
    }

    // 4. Migrate Collections
    console.log("📦 Migrating Collection entities...");
    if (seedCollection && seedCollection.length > 0) {
      await collectionRepository.save(seedCollection[0] as any);
    }

    // 5. Migrate Categories (automatically saves slugs and localizations!)
    console.log("🏷️ Migrating Category entities...");
    for (const cat of seedCategories) {
      await categoryRepository.save(cat as any);
    }

    // 6. Migrate Tags (automatically saves slugs!)
    console.log("🏷️ Migrating Tag entities...");
    for (const tag of seedTags) {
      await tagRepository.save(tag as any);
    }

    // 7. Migrate Posts (automatically saves slugs, localizations, and media!)
    console.log("📝 Migrating Post entities...");
    for (const post of seedPosts) {
      await postRepository.save(post as any);
    }

    console.log("✨ Migration completed successfully!");
    
    // Clear migration env variable
    delete process.env.MIGRATION;

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully! Database seeded with UUIDs and crop coordinates.",
    });
  } catch (error: any) {
    console.error("❌ Migration failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "An unexpected error occurred during migration",
      },
      { status: 500 }
    );
  }
}

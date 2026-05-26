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
import {
  seedUser,
  seedColors,
  seedCollection,
  seedCategories,
  seedTags,
  seedPosts,
} from "@/migrations/seedData";

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
    await userRepository.save(seedUser);

    // 3. Migrate Colors
    console.log("🎨 Migrating Color entities...");
    for (const color of seedColors) {
      await colorRepository.save(color);
    }

    // 4. Migrate Collections
    console.log("📦 Migrating Collection entities...");
    await collectionRepository.save(seedCollection);

    // 5. Migrate Categories (automatically saves slugs and localizations!)
    console.log("🏷️ Migrating Category entities...");
    for (const cat of seedCategories) {
      await categoryRepository.save(cat);
    }

    // 6. Migrate Tags (automatically saves slugs!)
    console.log("🏷️ Migrating Tag entities...");
    for (const tag of seedTags) {
      await tagRepository.save(tag);
    }

    // 7. Migrate Posts (automatically saves slugs, localizations, and media!)
    console.log("📝 Migrating Post entities...");
    for (const post of seedPosts) {
      await postRepository.save(post);
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

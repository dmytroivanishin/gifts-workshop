import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import seedUser from "@/migrations/initial-data/users.json";
import seedColors from "@/migrations/initial-data/colors.json";
import seedMedia from "@/migrations/initial-data/media.json";
import seedCollection from "@/migrations/initial-data/collections.json";
import seedCategories from "@/migrations/initial-data/categories.json";
import seedTags from "@/migrations/initial-data/tags.json";
import seedPosts from "@/migrations/initial-data/posts.json";

const DB_PATH = path.join(process.cwd(), "src/data/db.json");

export async function GET() {
  try {
    console.log("🚀 Starting direct filesystem database migration...");

    // 1. Map Users exactly
    const mappedUsers = seedUser.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      password: user.password,
    }));

    // 2. Map Colors exactly
    const mappedColors = seedColors.map((color: any) => ({
      id: color.id,
      userId: color.userId || "c0a80101-1111-4444-9999-abcdefabcdef",
      colorId: color.colorId,
    }));

    // 3. Map Media exactly
    const mappedMedia = seedMedia.map((media: any) => ({
      id: media.id,
      thumbnailUrl: media.thumbnailUrl,
      originalUrl: media.originalUrl,
      userId: media.userId || "c0a80101-1111-4444-9999-abcdefabcdef",
    }));

    // 4. Map Collections exactly
    const mappedCollections = seedCollection.map((col: any) => ({
      id: col.id,
      slug: col.slug,
      title: { ru: col.title?.ru || "", en: col.title?.en || "" },
      description: { ru: col.description?.ru || "", en: col.description?.en || "" },
      main: col.main ?? false,
      userId: col.userId || "c0a80101-1111-4444-9999-abcdefabcdef",
    }));

    // 5. Map Categories exactly
    const mappedCategories = seedCategories.map((cat: any) => ({
      id: cat.id,
      order: cat.order ?? 0,
      slug: cat.slug,
      title: { ru: cat.title?.ru || "", en: cat.title?.en || "" },
      description: { ru: cat.description?.ru || "", en: cat.description?.en || "" },
      collectionId: cat.collectionId || "all",
      userId: cat.userId || "c0a80101-1111-4444-9999-abcdefabcdef",
      colorId: cat.colorId || undefined,
      parentId: cat.parentId || undefined,
      tagsIds: Array.isArray(cat.tagsIds) ? cat.tagsIds : [],
    }));

    // 6. Map Tags exactly
    const mappedTags = seedTags.map((tag: any) => ({
      id: tag.id,
      slug: tag.slug,
      title: { ru: tag.title?.ru || "", en: tag.title?.en || "" },
      userId: tag.userId || "c0a80101-1111-4444-9999-abcdefabcdef",
    }));

    // 7. Map Posts with structural transformations
    const mappedPosts = seedPosts.map((post: any) => {
      // Resolve posterId object (seed format: { media: "id", ... }) to string ID
      let posterId = undefined;
      if (post.posterId) {
        if (typeof post.posterId === "string") {
          posterId = post.posterId;
        } else if (typeof post.posterId === "object" && post.posterId.media) {
          posterId = post.posterId.media;
        }
      }

      // Map relation post media elements (seed has 'media: "id"', database needs 'mediaId: "id"')
      const mappedPostMedia = Array.isArray(post.media)
        ? post.media.map((pm: any) => {
            const mediaId = pm.mediaId || (pm.media && typeof pm.media === "string" ? pm.media : (pm.media && pm.media.id) || undefined);
            return {
              id: pm.id || randomUUID(),
              order: pm.order || 0,
              mediaId,
              position: pm.position || undefined,
            };
          }).filter((m: any) => !!m.mediaId)
        : [];

      return {
        id: post.id,
        title: { ru: post.title?.ru || "", en: post.title?.en || "" },
        description: { ru: post.description?.ru || "", en: post.description?.en || "" },
        slug: post.slug,
        in_stock: post.in_stock ?? true,
        status: post.status === "published" ? "Published" : (post.status === "draft" ? "Draft" : (post.status || "Published")),
        collectionId: post.collectionId || "all",
        categoryId: post.categoryId || "",
        tagsIds: Array.isArray(post.tagsIds) ? post.tagsIds : [],
        posterId,
        media: mappedPostMedia,
        userId: post.userId || "c0a80101-1111-4444-9999-abcdefabcdef",
      };
    });

    const finalDb = {
      posts: mappedPosts,
      categories: mappedCategories,
      collections: mappedCollections,
      colors: mappedColors,
      tags: mappedTags,
      slugs: [],
      media: mappedMedia,
      users: mappedUsers,
      localizations: [],
      "$schema": "./node_modules/json-server/schema.json"
    };

    console.log("💾 Writing compiled data to db.json...");
    await fs.writeFile(DB_PATH, JSON.stringify(finalDb, null, 2), "utf-8");
    console.log("✨ Migration completed successfully!");

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully! Database seeded directly with correct UUIDs and structures.",
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

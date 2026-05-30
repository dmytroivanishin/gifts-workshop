import fs from 'fs';
import path from 'path';
import { drizzleDatabase } from '@/repositories/drizzle/database';
import { colorRepository } from '@/repositories/drizzle/colorRepository';
import { collectionRepository } from '@/repositories/drizzle/collectionRepository';
import { categoryRepository } from '@/repositories/drizzle/categoryRepository';
import { tagRepository } from '@/repositories/drizzle/tagRepository';
import { userRepository } from '@/repositories/drizzle/userRepository';
import "dotenv/config"; // Ensure env vars are loaded

// Polyfill dynamic env loading for standalone scripts
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

async function runSeed() {
  console.log("🌱 Starting initial database seed...");

  const uri = process.env.DB_URI;
  if (!uri) {
    throw new Error("❌ DB_URI is not set in environment.");
  }

  // Connect database
  await drizzleDatabase.connect(uri);

  try {
    const dataPath = path.join(process.cwd(), 'src/migrations/initial-data');

    // 0. Seed Default Admin User (to satisfy foreign keys)
    console.log("👤 Seeding default admin user...");
    const adminUser = {
      id: "c0a80101-1111-4444-9999-abcdefabcdef",
      name: "Admin",
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      password: "temporary_hashed_password" // Will be overwritten on login or admin change
    };
    await userRepository.save(adminUser);

    // 1. Seed Colors
    console.log("🎨 Seeding colors...");
    const colorsData = JSON.parse(fs.readFileSync(path.join(dataPath, 'colors.json'), 'utf-8'));
    await colorRepository.saveMany(colorsData);

    // 2. Seed Collections
    console.log("📚 Seeding collections...");
    const collectionsData = JSON.parse(fs.readFileSync(path.join(dataPath, 'collections.json'), 'utf-8'));
    await collectionRepository.saveMany(collectionsData);

    // 3. Seed Categories
    console.log("📁 Seeding categories...");
    const categoriesData = JSON.parse(fs.readFileSync(path.join(dataPath, 'categories.json'), 'utf-8'));
    await categoryRepository.saveMany(categoriesData);

    // 4. Seed Tags
    console.log("🏷️ Seeding tags...");
    const tagsData = JSON.parse(fs.readFileSync(path.join(dataPath, 'tags.json'), 'utf-8'));
    await tagRepository.saveMany(tagsData);

    console.log("✅ Seed completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await drizzleDatabase.close();
    process.exit(0);
  }
}

runSeed();

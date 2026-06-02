import { drizzleDatabase } from "../src/repositories/drizzle/database";
import { systemTextRepository } from "../src/repositories/drizzle/systemTextRepository";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const validationTexts = [
  { id: "error_invalid_format", content: { ru: "Неверный формат данных", en: "Invalid data format" } },
  { id: "error_missing_title", content: { ru: "Отсутствует название", en: "Title is missing" } },
  { id: "error_missing_poster", content: { ru: "Отсутствует обложка", en: "Cover image is missing" } },
  { id: "error_missing_collection", content: { ru: "Отсутствует коллекция", en: "Collection is missing" } },
  { id: "error_missing_category", content: { ru: "Отсутствует категория", en: "Category is missing" } },
  { id: "error_invalid_slug", content: { ru: "Неверный формат ссылки", en: "Invalid slug format" } },
  { id: "error_invalid_uuid", content: { ru: "Неверный ID", en: "Invalid ID format" } }
];

async function seedValidationTexts() {
  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    console.error("DB_URI is not set!");
    process.exit(1);
  }

  await drizzleDatabase.connect(dbUri);

  console.log("Seeding validation texts via repository...");

  for (const text of validationTexts) {
    await systemTextRepository.save(text);
    console.log(`Added/Updated: ${text.id}`);
  }

  console.log("Seeding completed successfully!");
  process.exit(0);
}

seedValidationTexts().catch(console.error);

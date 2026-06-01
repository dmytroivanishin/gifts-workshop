import { drizzleDatabase } from "../src/repositories/drizzle/database";
import { languages, systemTexts } from "../src/repositories/drizzle/schema";
import ru from "../src/i18n/ru.json";
import en from "../src/i18n/en.json";
import { randomUUID } from "crypto";

async function seed() {
  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    console.error("DB_URI is not set!");
    process.exit(1);
  }

  await drizzleDatabase.connect(dbUri);
  const db = drizzleDatabase.getDb();

  console.log("Seeding languages...");
  
  // Clear existing
  await db.delete(languages);
  await db.delete(systemTexts);

  // Insert languages
  await db.insert(languages).values([
    { id: randomUUID(), code: "ru", name: "Русский", isActive: true },
    { id: randomUUID(), code: "en", name: "English", isActive: true },
  ]);

  console.log("Seeding system texts...");
  
  // Merge keys from both files
  const keys = new Set([...Object.keys(ru), ...Object.keys(en)]);
  
  const textsToInsert = Array.from(keys).map((key) => {
    return {
      id: key,
      content: {
        ru: (ru as any)[key] || "",
        en: (en as any)[key] || "",
      }
    };
  });

  // Insert in chunks of 50 to avoid parameter limits
  for (let i = 0; i < textsToInsert.length; i += 50) {
    const chunk = textsToInsert.slice(i, i + 50);
    await db.insert(systemTexts).values(chunk);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);

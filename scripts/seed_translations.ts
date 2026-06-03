import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pgTable, varchar, jsonb } from "drizzle-orm/pg-core";
import path from "path";

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") });

const systemTexts = pgTable("system_texts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  content: jsonb("content").notNull(),
});

async function main() {
  if (!process.env.DB_URI) {
    console.error("No DB_URI found in .env.local");
    process.exit(1);
  }

  const client = postgres(process.env.DB_URI, { max: 1 });
  const db = drizzle(client);

  try {
    console.log("Inserting translations into the database...");
    
    // Insert "update"
    await db.insert(systemTexts).values({
      id: "update",
      content: { ru: "Обновить", en: "Update" }
    }).onConflictDoUpdate({
      target: systemTexts.id,
      set: { content: { ru: "Обновить", en: "Update" } }
    });

    // Insert "creation_date"
    await db.insert(systemTexts).values({
      id: "creation_date",
      content: { ru: "Дата публикации", en: "Publication Date" }
    }).onConflictDoUpdate({
      target: systemTexts.id,
      set: { content: { ru: "Дата публикации", en: "Publication Date" } }
    });

    console.log("Translations successfully added!");
  } catch (error) {
    console.error("Error inserting translations:", error);
  } finally {
    await client.end();
  }
}

main();

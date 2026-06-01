import { drizzleDatabase } from "../src/repositories/drizzle/database";
import { systemTextRepository } from "../src/repositories/drizzle/systemTextRepository";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function addMissingKey() {
  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    console.error("DB_URI is not set!");
    process.exit(1);
  }

  await drizzleDatabase.connect(dbUri);

  console.log("Adding manage_languages via repository...");
  
  const existing = await systemTextRepository.getById("manage_languages");
  
  if (!existing) {
    await systemTextRepository.save({
      id: "manage_languages",
      content: {
        ru: "Управление языками",
        en: "Manage Languages",
      }
    });
    console.log("Added manage_languages successfully!");
  } else {
    console.log("manage_languages already exists in the database.");
  }

  process.exit(0);
}

addMissingKey().catch(console.error);

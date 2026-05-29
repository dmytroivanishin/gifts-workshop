import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load DB_URI from .env.local
config({ path: ".env.local", override: true });

if (!process.env.DB_URI) {
  throw new Error("❌ DB_URI is not defined in .env.local");
}

export default defineConfig({
  schema: "./src/repositories/drizzle/schema.ts",
  out: "./src/repositories/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DB_URI,
  },
});

import { defineConfig } from "drizzle-kit";

if (!process.env.DB_URI) {
  throw new Error("❌ DB_URI is not defined");
}

export default defineConfig({
  schema: "./src/repositories/drizzle/schema.ts",
  out: "./src/repositories/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DB_URI,
  },
});

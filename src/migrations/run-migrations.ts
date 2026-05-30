import postgres from 'postgres';
import { config } from 'dotenv';

// Load variables from .env.local with override
config({ path: '.env.local', override: true });

async function migrate() {
  const uri = process.env.DB_URI;
  if (!uri) {
    console.error("❌ DB_URI is not defined in environment.");
    process.exit(1);
  }

  console.log("⚙️ Connecting to database to fix token_sessions table...");
  const sql = postgres(uri);

  try {
    console.log("⚡ Dropping old token_sessions table (if exists)...");
    await sql.unsafe(`DROP TABLE IF EXISTS "token_sessions" CASCADE;`);

    console.log("⚡ Creating token_sessions table with correct types (uuid and timestamp)...");
    await sql.unsafe(`
      CREATE TABLE "token_sessions" (
        "id" uuid PRIMARY KEY NOT NULL,
        "user_id" uuid NOT NULL,
        "refresh_token_hash" text NOT NULL,
        "is_used" boolean DEFAULT false NOT NULL,
        "expires_at" timestamp NOT NULL,
        "token_family" varchar(255) NOT NULL,
        CONSTRAINT "token_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
      );
    `);

    console.log("🎉 token_sessions table successfully recreated with uuid and timestamp types!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

migrate();

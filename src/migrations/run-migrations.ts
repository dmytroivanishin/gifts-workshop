import fs from 'fs';
import path from 'path';
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

  console.log("⚙️ Connecting to database to apply migrations...");
  const sql = postgres(uri);

  try {
    const migrationFile = path.join(
      process.cwd(),
      'src/repositories/drizzle/migrations/0000_cloudy_stardust.sql'
    );

    if (!fs.existsSync(migrationFile)) {
      throw new Error(`❌ Migration file not found at ${migrationFile}`);
    }

    console.log("📄 Reading migration SQL file...");
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');

    // Drizzle splits statements using special comments '--> statement-breakpoint'
    const statements = sqlContent.split('--> statement-breakpoint');

    console.log(`⚡ Found ${statements.length} SQL statements to execute.`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      console.log(`Executing statement [${i + 1}/${statements.length}]...`);
      await sql.unsafe(stmt);
    }

    console.log("✅ All migrations applied successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

migrate();

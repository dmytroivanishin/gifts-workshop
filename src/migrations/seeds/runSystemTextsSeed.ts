import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables before anything else
dotenv.config({ path: path.resolve(process.cwd(), 'config/local.env') });

async function main() {
  // Dynamically import to ensure env vars are loaded first (avoid import hoisting issues)
  const { drizzleDatabase } = await import('../../repositories/drizzle/database');
  const { systemTexts } = await import('../../repositories/drizzle/schema');
  const { default: data } = await import('./initial-data/system-texts.json', { with: { type: "json" } }).catch(() => import('./initial-data/system-texts.json'));
  const { env } = await import("../../modules/core/env");

  if (!env.DB_URI) throw new Error("DB_URI is not set in environment variables");
  
  await drizzleDatabase.connect(env.DB_URI);
  const db = drizzleDatabase.getDb();
  
  console.log("Seeding system texts...");
  let count = 0;
  for (const item of data) {
    await db.insert(systemTexts).values({
      id: item.id,
      code: item.code,
      content: item.content as Record<string, string>,
      area: item.area,
    }).onConflictDoNothing({
      target: systemTexts.code
    });
    count++;
  }
  
  console.log(`Successfully seeded ${count} system texts!`);
  await drizzleDatabase.close();
  process.exit(0);
}

main().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});

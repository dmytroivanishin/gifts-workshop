import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";
import { env } from "@/modules/core/env";
import { logger } from "@/modules/logger";
import { drizzleDatabase } from "@/repositories/drizzle/database";

// One migration = one folder `<13-digit ms timestamp>_<name>/` with `up.sql` (schema, written by
// hand) and optionally `seed.ts` (initial rows). Folders run in name order, each at most once.
// The schema part runs in a transaction together with its bookkeeping row; the seed part runs
// after it and is idempotent (rows are upserted by id), so a failed seed is simply retried.

const MIGRATIONS_DIR = __dirname;
const FOLDER_PATTERN = /^\d{13}_[a-z0-9_]+$/;
const LOCK_KEY = "gifts_workshop_migrations";

interface MigrationRecord {
  readonly name: string;
  readonly checksum: string;
  readonly schema_applied_at: Date | null;
  readonly seed_applied_at: Date | null;
}

interface SeedModule {
  readonly seed: () => Promise<void>;
}

function discoverMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && FOLDER_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function ensureBookkeepingTable(sql: postgres.Sql): Promise<void> {
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      checksum text not null,
      schema_applied_at timestamptz,
      seed_applied_at timestamptz,
      created_at timestamptz not null default now()
    )`;
}

async function applySchema(sql: postgres.Sql, name: string): Promise<void> {
  const upSql = readFileSync(path.join(MIGRATIONS_DIR, name, "up.sql"), "utf8");
  const checksum = createHash("sha256").update(upSql).digest("hex");

  const [existing] = await sql<MigrationRecord[]>`
    select name, checksum, schema_applied_at, seed_applied_at
    from schema_migrations where name = ${name}`;
  if (existing) {
    if (existing.checksum !== checksum) {
      throw new Error(`${name}: up.sql changed after it was applied. Applied migrations are never edited; add a new folder instead.`);
    }
    return;
  }

  // `--> statement-breakpoint` lines are SQL comments, so the whole file runs as one script.
  await sql.begin(async (tx) => {
    await tx.unsafe(upSql);
    await tx`insert into schema_migrations (name, checksum, schema_applied_at) values (${name}, ${checksum}, now())`;
  });
  logger.info(`Schema applied: ${name}`);
}

async function applySeed(sql: postgres.Sql, name: string): Promise<void> {
  if (!existsSync(path.join(MIGRATIONS_DIR, name, "seed.ts"))) return;

  const [record] = await sql<MigrationRecord[]>`
    select name, checksum, schema_applied_at, seed_applied_at
    from schema_migrations where name = ${name}`;
  if (record?.seed_applied_at) return;

  const seedModule = (await import(`./${name}/seed`)) as SeedModule;
  await seedModule.seed();
  await sql`update schema_migrations set seed_applied_at = now() where name = ${name}`;
  logger.info(`Seed applied: ${name}`);
}

async function main(): Promise<void> {
  // max 1: the advisory lock is session-scoped, so every statement must use the same connection.
  const sql = postgres(env.DB_URI, { max: 1 });
  try {
    await sql`select pg_advisory_lock(hashtext(${LOCK_KEY}))`;
    await ensureBookkeepingTable(sql);
    for (const name of discoverMigrations()) {
      await applySchema(sql, name);
      await applySeed(sql, name);
    }
  } finally {
    await sql`select pg_advisory_unlock(hashtext(${LOCK_KEY}))`.catch(() => undefined);
    await sql.end();
    await drizzleDatabase.close();
  }
}

main()
  .then(() => {
    logger.info("Migrations complete.");
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Migration failed", { code: "MIGRATION_FAILED", error: message });
    process.exit(1);
  });

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";
import { env } from "@/modules/core/env";

// Proves that the hand-written up.sql files and schema.ts describe the same database: builds a
// throwaway database from every up.sql, then asks drizzle-kit to diff schema.ts against it.
// Never touches the database named in DB_URI. Requires the server to allow CREATE DATABASE.

const MIGRATIONS_DIR = path.join(__dirname);
const FOLDER_PATTERN = /^\d{13}_[a-z0-9_]+$/;

function withDatabase(uri: string, database: string): string {
  const url = new URL(uri);
  url.pathname = `/${database}`;
  return url.toString();
}

async function main(): Promise<void> {
  const dbName = `verify_schema_${Date.now()}`;
  const adminUri = withDatabase(env.DB_URI, "postgres");
  const targetUri = withDatabase(env.DB_URI, dbName);

  const admin = postgres(adminUri, { max: 1 });
  await admin.unsafe(`create database "${dbName}"`);
  const target = postgres(targetUri, { max: 1 });
  try {
    const folders = (await import("node:fs")).readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && FOLDER_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    for (const folder of folders) {
      await target.unsafe(readFileSync(path.join(MIGRATIONS_DIR, folder, "up.sql"), "utf8"));
    }

    const output = execFileSync("npx", ["drizzle-kit", "push", "--force"], {
      env: { ...process.env, DB_URI: targetUri },
      encoding: "utf8",
    });
    if (!/No changes detected/i.test(output)) {
      throw new Error(`schema.ts and up.sql differ:\n${output}`);
    }
    process.stdout.write("OK: up.sql matches schema.ts\n");
  } finally {
    await target.end();
    await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
    await admin.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

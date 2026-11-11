// Compares the media folder with the `media` table: lists files no row points at (left behind by a failed
// upload or delete) and rows whose files are gone. Read-only unless --delete is passed. With --delete it also
// removes temporary files left by a write that was interrupted, if they are older than one hour.
//
//   bash scripts/run.sh media:reconcile                          # report only
//   bash scripts/run.sh media:reconcile -- --delete              # also remove orphans and stale temp files
//   bash scripts/run.sh media:reconcile -- --min-age-minutes=10  # treat only files older than 10 min as orphans
//
// Memory stays flat: files are read one at a time, and the database is asked about them in batches of 500.
// The folder and the URL prefix come from S3_BUCKET_NAME and S3_PUBLIC_URL (see src/modules/storage/mediaFolder.ts).
import { LocalFolderStorage } from "../src/modules/storage/localFolderStorage";
import { mediaFolderRoot, mediaPublicBaseUrl } from "../src/modules/storage/mediaFolder";
import { findMissingKeys, findOrphanKeys } from "../src/modules/storage/reconcile";
import { drizzleDatabase } from "../src/repositories/drizzle/database";
import { mediaRepository } from "../src/repositories/drizzle/mediaRepository";
import { env } from "../src/modules/core/env";

const DEFAULT_MIN_AGE_MINUTES = 60;
const STALE_TEMP_MINUTES = 60;
const ROW_PAGE_SIZE = 500;

function readMinAgeMinutes(args: string[]): number {
  const flag = args.find((arg) => arg.startsWith("--min-age-minutes="));
  const value = flag ? Number(flag.split("=")[1]) : DEFAULT_MIN_AGE_MINUTES;
  if (!Number.isFinite(value) || value < 0) throw new Error("--min-age-minutes must be a non-negative number");
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldDelete = args.includes("--delete");
  const minAgeMinutes = readMinAgeMinutes(args);
  const storage = new LocalFolderStorage(mediaFolderRoot());
  const publicBaseUrl = mediaPublicBaseUrl();

  await drizzleDatabase.connect(env.DB_URI);

  // Phase 1: files on disk that no row uses. Only the orphans are kept, so memory grows with the number of
  // orphans (normally zero), not with the number of files. Deletion waits until the walk is finished.
  const orphanKeys = await findOrphanKeys(storage.listObjects(), (urls) => mediaRepository.findUrlsIn(urls), {
    publicBaseUrl,
    minAgeMs: minAgeMinutes * 60_000,
    now: new Date(),
  });

  // Phase 2: rows whose file is gone. Rows are read a page at a time.
  const missingKeys: string[] = [];
  let rowCount = 0;
  for (let offset = 0; ; offset += ROW_PAGE_SIZE) {
    const page = await mediaRepository.getAll({ limit: ROW_PAGE_SIZE, offset });
    rowCount += page.length;
    missingKeys.push(...(await findMissingKeys(page, publicBaseUrl, (keys) => storage.existingKeys(keys))));
    if (page.length < ROW_PAGE_SIZE) break;
  }

  console.log(`Media rows checked: ${rowCount}`);
  console.log(`Orphan files (no row, older than ${minAgeMinutes} min): ${orphanKeys.length}`);
  orphanKeys.forEach((key) => console.log(`  orphan  ${key}`));
  console.log(`Rows with a missing file: ${missingKeys.length}`);
  missingKeys.forEach((key) => console.log(`  missing ${key}`));

  if (!shouldDelete) {
    if (orphanKeys.length > 0) console.log("Nothing removed. Run again with --delete to remove the orphans.");
    await drizzleDatabase.close();
    return;
  }

  if (orphanKeys.length > 0) {
    const result = await storage.remove(orphanKeys);
    console.log(`Removed ${result.removed.length} orphan file(s).`);
    result.failed.forEach(({ key, reason }) => console.log(`  failed  ${key} (${reason})`));
  }

  const staleTemp = await storage.removeStaleTemp(STALE_TEMP_MINUTES * 60_000);
  console.log(`Removed ${staleTemp} temporary file(s) older than ${STALE_TEMP_MINUTES} min.`);

  await drizzleDatabase.close();
}

main().catch((error) => {
  console.error("Reconcile failed:", error);
  process.exit(1);
});

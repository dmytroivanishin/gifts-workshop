// Compares the MinIO bucket with the `media` table: lists objects no row points at (left behind by a failed
// upload or delete) and rows whose objects are gone. Read-only unless --delete is passed.
//
//   bash scripts/run.sh media:reconcile                          # report only (loads config/local.env)
//   bash scripts/run.sh media:reconcile -- --delete              # also remove the orphan objects
//   bash scripts/run.sh media:reconcile -- --min-age-minutes=10  # treat only objects older than 10 min as orphans
import { getBucketName, getMinioClient } from "../src/modules/storage/minioClient";
import { drizzleDatabase } from "../src/repositories/drizzle/database";
import { mediaRepository } from "../src/repositories/drizzle/mediaRepository";
import { reconcileMedia, BucketObject } from "../src/modules/storage/reconcile";
import { env } from "../src/modules/core/env";

const DEFAULT_MIN_AGE_MINUTES = 60;

function readMinAgeMinutes(args: string[]): number {
  const flag = args.find((arg) => arg.startsWith("--min-age-minutes="));
  const value = flag ? Number(flag.split("=")[1]) : DEFAULT_MIN_AGE_MINUTES;
  if (!Number.isFinite(value) || value < 0) throw new Error("--min-age-minutes must be a non-negative number");
  return value;
}

async function listBucketObjects(): Promise<BucketObject[]> {
  // The bucket is created lazily on the first upload, so a fresh MinIO has no bucket yet: nothing to list.
  if (!(await getMinioClient().bucketExists(getBucketName()))) return [];

  return new Promise((resolve, reject) => {
    const objects: BucketObject[] = [];
    const stream = getMinioClient().listObjectsV2(getBucketName(), "", true);
    stream.on("data", (item) => {
      if (item.name && item.lastModified) objects.push({ key: item.name, lastModified: item.lastModified });
    });
    stream.on("end", () => resolve(objects));
    stream.on("error", reject);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldDelete = args.includes("--delete");
  const minAgeMinutes = readMinAgeMinutes(args);

  await drizzleDatabase.connect(env.DB_URI);
  const rows = await mediaRepository.getAll();
  const objects = await listBucketObjects();

  const publicBaseUrl = `${new URL(env.S3_PUBLIC_URL).href.replace(/\/+$/, "")}/${getBucketName()}`;
  const report = reconcileMedia(objects, rows, publicBaseUrl, minAgeMinutes * 60_000);

  console.log(`Bucket objects: ${objects.length}, media rows: ${rows.length}`);
  console.log(`Orphan objects (no row, older than ${minAgeMinutes} min): ${report.orphanKeys.length}`);
  report.orphanKeys.forEach((key) => console.log(`  orphan  ${key}`));
  console.log(`Rows with a missing object: ${report.missingKeys.length}`);
  report.missingKeys.forEach((key) => console.log(`  missing ${key}`));

  if (shouldDelete && report.orphanKeys.length > 0) {
    await getMinioClient().removeObjects(getBucketName(), report.orphanKeys);
    console.log(`Removed ${report.orphanKeys.length} orphan object(s).`);
  } else if (report.orphanKeys.length > 0) {
    console.log("Nothing removed. Run again with --delete to remove the orphans.");
  }

  await drizzleDatabase.close();
}

main().catch((error) => {
  console.error("Reconcile failed:", error);
  process.exit(1);
});

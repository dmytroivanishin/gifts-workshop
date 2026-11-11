import type { StoredObject } from "@/interfaces/storage/mediaStorage";
import type { MediaUrls, OrphanScanOptions } from "@/interfaces/storage";

// Keys are checked against the database in batches of this size, so memory stays flat however many files exist.
export const RECONCILE_BATCH_SIZE = 500;

// The URL a stored key is served from, the same shape StorageService builds: <base>/<key>.
export function urlForKey(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl}/${key}`;
}

// Returns the key behind one of our own URLs, or undefined for an external URL (not ours to check).
function keyFromUrl(url: string, publicBaseUrl: string): string | undefined {
  const prefix = `${publicBaseUrl}/`;
  return url && url.startsWith(prefix) ? url.slice(prefix.length) : undefined;
}

// Walks the stored files and returns those that no media row points at. Only the current batch of names is
// held in memory. The database answers for each batch: `findReferencedUrls` gets the candidate URLs and
// returns the ones some row uses (one query per batch, not one per file).
export async function findOrphanKeys(
  objects: AsyncIterable<StoredObject>,
  findReferencedUrls: (urls: string[]) => Promise<string[]>,
  options: OrphanScanOptions
): Promise<string[]> {
  const batchSize = options.batchSize ?? RECONCILE_BATCH_SIZE;
  const orphans: string[] = [];
  let batch: string[] = [];

  const checkBatch = async (): Promise<void> => {
    if (batch.length === 0) return;
    const urls = batch.map((key) => urlForKey(options.publicBaseUrl, key));
    const referenced = new Set(await findReferencedUrls(urls));
    batch.forEach((key, index) => {
      if (!referenced.has(urls[index])) orphans.push(key);
    });
    batch = [];
  };

  for await (const object of objects) {
    if (options.now.getTime() - object.lastModified.getTime() < options.minAgeMs) continue;
    batch.push(object.key);
    if (batch.length >= batchSize) await checkBatch();
  }
  await checkBatch();

  return orphans;
}

// The keys of one page of media rows whose files are missing from storage: the image is broken on the site.
// Called once per page of rows, so only that page's keys are held at a time.
export async function findMissingKeys(
  rows: MediaUrls[],
  publicBaseUrl: string,
  existingKeys: (keys: string[]) => Promise<Set<string>>
): Promise<string[]> {
  const wanted = new Set<string>();
  for (const { originalUrl, thumbnailUrl } of rows) {
    for (const url of [originalUrl, thumbnailUrl]) {
      const key = keyFromUrl(url, publicBaseUrl);
      if (key) wanted.add(key);
    }
  }
  const keys = [...wanted];
  const present = await existingKeys(keys);
  return keys.filter((key) => !present.has(key));
}

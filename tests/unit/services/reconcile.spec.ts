import { describe, it, expect } from "vitest";
import { findMissingKeys, findOrphanKeys } from "@/modules/storage/reconcile";
import type { StoredObject } from "@/interfaces/storage/mediaStorage";

const BASE = "http://localhost:9000/bucket";
const now = new Date("2026-11-09T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const HOUR = 60 * 60_000;

async function* stream(objects: StoredObject[]): AsyncGenerator<StoredObject> {
  for (const object of objects) yield object;
}

// A stand-in for the database: answers with the URLs that some "row" uses, like the real query does.
function databaseWith(urls: string[]): (batch: string[]) => Promise<string[]> {
  const known = new Set(urls);
  return async (batch) => batch.filter((url) => known.has(url));
}

describe("findOrphanKeys", () => {
  it("finds nothing when every file is referenced by a row", async () => {
    const orphans = await findOrphanKeys(
      stream([
        { key: "a/preview.jpg", lastModified: ago(500), size: 1 },
        { key: "a/thumb.jpg", lastModified: ago(500), size: 1 },
      ]),
      databaseWith([`${BASE}/a/preview.jpg`, `${BASE}/a/thumb.jpg`]),
      { publicBaseUrl: BASE, minAgeMs: HOUR, now }
    );
    expect(orphans).toEqual([]);
  });

  it("reports an old file that no row uses", async () => {
    const orphans = await findOrphanKeys(
      stream([{ key: "gone/preview.jpg", lastModified: ago(500), size: 1 }]),
      databaseWith([]),
      { publicBaseUrl: BASE, minAgeMs: HOUR, now }
    );
    expect(orphans).toEqual(["gone/preview.jpg"]);
  });

  it("does not report a fresh file: its upload may still be saving the row", async () => {
    const orphans = await findOrphanKeys(
      stream([{ key: "new/preview.jpg", lastModified: ago(2), size: 1 }]),
      databaseWith([]),
      { publicBaseUrl: BASE, minAgeMs: HOUR, now }
    );
    expect(orphans).toEqual([]);
  });

  it("asks the database once per batch, never once per file", async () => {
    const files = Array.from({ length: 7 }, (_, index) => ({
      key: `f${index}/preview.jpg`,
      lastModified: ago(500),
      size: 1,
    }));
    let calls = 0;
    const orphans = await findOrphanKeys(stream(files), async (batch) => {
      calls++;
      return batch.filter((url) => url.endsWith("f3/preview.jpg"));
    }, { publicBaseUrl: BASE, minAgeMs: HOUR, now, batchSize: 3 });

    expect(calls).toBe(3); // 7 files in batches of 3: 3 + 3 + 1
    expect(orphans).toHaveLength(6);
    expect(orphans).not.toContain("f3/preview.jpg");
  });

  it("keeps only the current batch in memory: each batch is answered before the next file is read", async () => {
    const seen: number[] = [];
    let pulled = 0;
    async function* counting(): AsyncGenerator<StoredObject> {
      for (let index = 0; index < 4; index++) {
        pulled++;
        yield { key: `k${index}/p.jpg`, lastModified: ago(500), size: 1 };
      }
    }
    await findOrphanKeys(counting(), async () => {
      seen.push(pulled);
      return [];
    }, { publicBaseUrl: BASE, minAgeMs: HOUR, now, batchSize: 2 });

    // The first batch is answered after two files were pulled, not after all four.
    expect(seen).toEqual([2, 4]);
  });
});

describe("findMissingKeys", () => {
  it("reports a row whose file is absent from storage", async () => {
    const missing = await findMissingKeys(
      [{ originalUrl: `${BASE}/a/preview.jpg`, thumbnailUrl: `${BASE}/a/thumb.jpg` }],
      BASE,
      async (keys) => new Set(keys.filter((key) => key === "a/preview.jpg"))
    );
    expect(missing).toEqual(["a/thumb.jpg"]);
  });

  it("ignores rows that point at an external host", async () => {
    const missing = await findMissingKeys(
      [{ originalUrl: "https://cdn.example.com/x.jpg", thumbnailUrl: "https://cdn.example.com/x.jpg" }],
      BASE,
      async () => new Set()
    );
    expect(missing).toEqual([]);
  });
});

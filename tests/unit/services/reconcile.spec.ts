import { describe, it, expect } from "vitest";
import { reconcileMedia } from "@/modules/storage/reconcile";

const BASE = "http://localhost:9000/bucket";
const now = new Date("2026-11-09T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const HOUR = 60 * 60_000;

describe("reconcileMedia", () => {
  it("finds nothing when every object has a row and every row has its objects", () => {
    const report = reconcileMedia(
      [
        { key: "a/preview.jpg", lastModified: ago(500) },
        { key: "a/thumb.jpg", lastModified: ago(500) },
      ],
      [{ originalUrl: `${BASE}/a/preview.jpg`, thumbnailUrl: `${BASE}/a/thumb.jpg` }],
      BASE,
      HOUR,
      now
    );
    expect(report).toEqual({ orphanKeys: [], missingKeys: [] });
  });

  it("reports an old object without a row as an orphan", () => {
    const report = reconcileMedia([{ key: "gone/preview.jpg", lastModified: ago(500) }], [], BASE, HOUR, now);
    expect(report.orphanKeys).toEqual(["gone/preview.jpg"]);
  });

  it("does not call a fresh object an orphan: its upload may still be saving the row", () => {
    const report = reconcileMedia([{ key: "new/preview.jpg", lastModified: ago(2) }], [], BASE, HOUR, now);
    expect(report.orphanKeys).toEqual([]);
  });

  it("reports a row whose objects are absent from the bucket", () => {
    const report = reconcileMedia(
      [{ key: "a/preview.jpg", lastModified: ago(500) }],
      [{ originalUrl: `${BASE}/a/preview.jpg`, thumbnailUrl: `${BASE}/a/thumb.jpg` }],
      BASE,
      HOUR,
      now
    );
    expect(report.missingKeys).toEqual(["a/thumb.jpg"]);
  });

  it("ignores rows that point at an external host", () => {
    const report = reconcileMedia(
      [],
      [{ originalUrl: "https://cdn.example.com/x.jpg", thumbnailUrl: "https://cdn.example.com/x.jpg" }],
      BASE,
      HOUR,
      now
    );
    expect(report.missingKeys).toEqual([]);
  });
});

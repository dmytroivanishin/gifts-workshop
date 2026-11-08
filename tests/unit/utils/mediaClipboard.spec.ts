import { describe, it, expect } from "vitest";

import {
  MEDIA_CLIPBOARD_MAX,
  MEDIA_CLIPBOARD_TTL_MS,
  buildClipboard,
  parseClipboard,
  resolvePaste,
} from "@/utils/mediaClipboard";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const NOW = 1_800_000_000_000;

describe("buildClipboard", () => {
  it("serializes ids with the copy time and returns them back", () => {
    const { raw, ids } = buildClipboard([A, B], NOW);
    expect(ids).toEqual([A, B]);
    expect(JSON.parse(raw as string)).toEqual({ ids: [A, B], copiedAt: NOW });
  });

  it("drops duplicates, keeping the first occurrence and the order", () => {
    expect(buildClipboard([B, A, B, A, C], NOW).ids).toEqual([B, A, C]);
  });

  it("caps the buffer at the sanity ceiling", () => {
    const many = Array.from({ length: MEDIA_CLIPBOARD_MAX + 25 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`
    );
    expect(buildClipboard(many, NOW).ids).toHaveLength(MEDIA_CLIPBOARD_MAX);
  });

  it("returns no raw value for an empty buffer, so the caller removes the key", () => {
    expect(buildClipboard([], NOW)).toEqual({ raw: null, ids: [] });
  });
});

describe("parseClipboard", () => {
  it("round-trips what buildClipboard produced", () => {
    const { raw } = buildClipboard([A, B], NOW);
    expect(parseClipboard(raw, NOW + 1000)).toEqual([A, B]);
  });

  it("reads null and an empty string as an empty buffer", () => {
    expect(parseClipboard(null, NOW)).toEqual([]);
    expect(parseClipboard("", NOW)).toEqual([]);
  });

  it("treats corrupt JSON and the wrong shape as empty instead of throwing", () => {
    expect(parseClipboard("{not json", NOW)).toEqual([]);
    expect(parseClipboard(JSON.stringify({ ids: "nope", copiedAt: NOW }), NOW)).toEqual([]);
    expect(parseClipboard(JSON.stringify({ ids: [A] }), NOW)).toEqual([]);
    expect(parseClipboard(JSON.stringify([A, B]), NOW)).toEqual([]);
  });

  it("rejects the whole buffer if any id is not a UUID (hand-edited storage)", () => {
    expect(parseClipboard(JSON.stringify({ ids: [A, "'; drop table media"], copiedAt: NOW }), NOW)).toEqual([]);
  });

  it("expires a buffer older than the TTL but keeps one just inside it", () => {
    const { raw } = buildClipboard([A], NOW);
    expect(parseClipboard(raw, NOW + MEDIA_CLIPBOARD_TTL_MS)).toEqual([A]);
    expect(parseClipboard(raw, NOW + MEDIA_CLIPBOARD_TTL_MS + 1)).toEqual([]);
  });

  it("treats a copy time in the future (wrong clock) as expired", () => {
    const { raw } = buildClipboard([A], NOW + 60_000);
    expect(parseClipboard(raw, NOW)).toEqual([]);
  });
});

describe("resolvePaste", () => {
  const all = new Set([A, B, C]);

  it("adds everything that exists and the post does not have yet, in buffer order", () => {
    expect(resolvePaste([B, A], all, new Set())).toEqual({ toAdd: [B, A], missing: 0, alreadyPresent: 0 });
  });

  it("counts media deleted after copying as missing and does not add it", () => {
    expect(resolvePaste([A, B], new Set([A]), new Set())).toEqual({ toAdd: [A], missing: 1, alreadyPresent: 0 });
  });

  it("never adds a media the post already has", () => {
    expect(resolvePaste([A, B], all, new Set([A]))).toEqual({ toAdd: [B], missing: 0, alreadyPresent: 1 });
  });

  it("a missing media wins over already-present: it is reported as missing", () => {
    expect(resolvePaste([A], new Set(), new Set([A]))).toEqual({ toAdd: [], missing: 1, alreadyPresent: 0 });
  });

  it("returns nothing for an empty buffer", () => {
    expect(resolvePaste([], all, new Set())).toEqual({ toAdd: [], missing: 0, alreadyPresent: 0 });
  });
});

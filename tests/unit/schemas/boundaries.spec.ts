import { describe, it, expect } from "vitest";
import { bulkIdsSchema, commentSchema, categorySchema, postMediaSchema, postSchema, pageSchema } from "@/common/validation/schemas";

const uuid = () => crypto.randomUUID();

// CP-64 step 5: exact boundaries of the schemas, one value inside and one just outside each limit.
describe("bulkIdsSchema (1..500 UUIDs)", () => {
  it("accepts 1 and exactly 500 ids", () => {
    expect(bulkIdsSchema.safeParse({ ids: [uuid()] }).success).toBe(true);
    expect(bulkIdsSchema.safeParse({ ids: Array.from({ length: 500 }, uuid) }).success).toBe(true);
  });
  it("rejects 0 and 501 ids, a non-UUID, a missing field and a non-array", () => {
    expect(bulkIdsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(bulkIdsSchema.safeParse({ ids: Array.from({ length: 501 }, uuid) }).success).toBe(false);
    expect(bulkIdsSchema.safeParse({ ids: ["not-a-uuid"] }).success).toBe(false);
    expect(bulkIdsSchema.safeParse({}).success).toBe(false);
    expect(bulkIdsSchema.safeParse({ ids: uuid() }).success).toBe(false);
  });
});

describe("commentSchema limits (name 100, text 2000, measured after trimming)", () => {
  const base = { postId: uuid() };
  it("accepts exactly 100 / 2000 characters and rejects one more", () => {
    expect(commentSchema.safeParse({ ...base, name: "n".repeat(100), text: "t".repeat(2000) }).success).toBe(true);
    expect(commentSchema.safeParse({ ...base, name: "n".repeat(101), text: "t" }).success).toBe(false);
    expect(commentSchema.safeParse({ ...base, name: "n", text: "t".repeat(2001) }).success).toBe(false);
  });
  it("counts the trimmed length, so padding around a 100-character name does not push it over", () => {
    expect(commentSchema.safeParse({ ...base, name: `  ${"n".repeat(100)}  `, text: "t" }).success).toBe(true);
  });
  it("counts characters, not bytes: 100 Cyrillic letters pass", () => {
    expect(commentSchema.safeParse({ ...base, name: "я".repeat(100), text: "т" }).success).toBe(true);
  });
});

describe("postMediaSchema.order (non-negative integer)", () => {
  const mediaId = uuid();
  it("accepts 0 and a large integer", () => {
    expect(postMediaSchema.safeParse({ mediaId, order: 0 }).success).toBe(true);
    expect(postMediaSchema.safeParse({ mediaId, order: 1_000_000 }).success).toBe(true);
  });
  it("rejects negative, fractional and non-numeric orders", () => {
    expect(postMediaSchema.safeParse({ mediaId, order: -1 }).success).toBe(false);
    expect(postMediaSchema.safeParse({ mediaId, order: 1.5 }).success).toBe(false);
    expect(postMediaSchema.safeParse({ mediaId, order: "1" }).success).toBe(false);
  });
});

describe("categorySchema.order (optional integer, no default)", () => {
  const valid = { title: { en: "x" }, collectionId: uuid(), color: { color: "#fff" } };
  it("stays undefined when omitted so a save keeps the current position, and accepts negative integers", () => {
    expect(categorySchema.parse(valid).order).toBeUndefined();
    expect(categorySchema.safeParse({ ...valid, order: -3 }).success).toBe(true);
  });
  it("rejects fractional orders", () => {
    expect(categorySchema.safeParse({ ...valid, order: 0.5 }).success).toBe(false);
  });
});

describe("postSchema status, tags and gallery inputs", () => {
  it("rejects an unknown status and a non-array tagsIds, and turns null tags/media into empty lists", () => {
    expect(postSchema.safeParse({ status: "Hidden" }).success).toBe(false);
    expect(postSchema.safeParse({ tagsIds: "abc" }).success).toBe(false);
    const parsed = postSchema.parse({ tagsIds: null, media: null });
    expect(parsed.tagsIds).toEqual([]);
    expect(parsed.media).toEqual([]);
  });
  it("rejects a tag id that is not a UUID", () => {
    expect(postSchema.safeParse({ tagsIds: ["x"] }).success).toBe(false);
  });
});

describe("pageSchema keeps the description exactly as typed", () => {
  it("does not trim spaces or blank lines, and turns an empty slug into 'generate'", () => {
    const text = "  line one\n\n\n   line two  ";
    const parsed = pageSchema.parse({ title: { en: "T" }, description: { en: text }, slug: "" });
    expect(parsed.description.en).toBe(text);
    expect(parsed.slug).toBeUndefined();
    expect(parsed.showInMenu).toBe(true);
  });
});

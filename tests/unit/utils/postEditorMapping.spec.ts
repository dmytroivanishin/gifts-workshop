import { describe, it, expect } from "vitest";
import { postToFormValues, postToSelectedImages, buildTagOptions } from "@/app/admin/posts/[id]/postEditorMapping";
import type { PopulatedPost, Tag } from "@/types";

const tag = (id: string, ru: string): Tag => ({ id, slug: id, name: { ru } }) as Tag;

const basePost = {
  id: "p1",
  title: { ru: "Мишка" },
  description: "plain text",
  category: { id: "cat1" },
  collection: "col1",
  collectionId: "col1",
  inStock: true,
  status: "Draft",
  tags: [tag("t1", "а"), "t2"],
  poster: { id: "m1" },
  createdAt: "2026-11-09T10:30:00.000Z",
  media: [
    { order: 5, mediaId: "m1", media: { id: "m1", originalUrl: "http://x/1.jpg" }, position: { x: 1, y: 2, zoom: 3 } },
    { order: 9, mediaId: "m2", media: "m2" },
  ],
} as unknown as PopulatedPost;

describe("postToFormValues", () => {
  it("reads ids from populated objects and from bare id strings alike", () => {
    const values = postToFormValues(basePost, "ru");
    expect(values.categoryId).toBe("cat1");
    expect(values.collectionId).toBe("col1");
    expect(values.posterId).toBe("m1");
    expect(values.tagsIds).toEqual(["t1", "t2"]);
  });

  it("turns a plain-string description into a text for the current locale", () => {
    expect(postToFormValues(basePost, "en").description).toEqual({ en: "plain text" });
  });

  it("renumbers the gallery by position and keeps each crop", () => {
    expect(postToFormValues(basePost, "ru").media).toEqual([
      { order: 1, mediaId: "m1", position: { x: 1, y: 2, zoom: 3 } },
      { order: 2, mediaId: "m2", position: undefined },
    ]);
  });

  it("cuts the date to the minute for a datetime-local field", () => {
    expect(postToFormValues(basePost, "ru").createdAt).toBe("2026-11-09T10:30");
  });
});

describe("postToSelectedImages", () => {
  // Media is always a populated object on a post, and the editor shows the thumbnail everywhere.
  it("maps each gallery item to its thumbnail url and keeps the saved position", () => {
    const post = {
      ...basePost,
      media: [
        { order: 5, mediaId: "m1", media: { id: "m1", thumbnailUrl: "http://x/t1.jpg", originalUrl: "http://x/1.jpg" }, position: { x: 1, y: 2, zoom: 3 } },
        { order: 9, mediaId: "m2", media: { id: "m2", thumbnailUrl: "http://x/t2.jpg", originalUrl: "http://x/2.jpg" }, position: undefined },
      ],
    } as unknown as typeof basePost;
    expect(postToSelectedImages(post)).toEqual([
      { mediaId: "m1", url: "http://x/t1.jpg", position: { x: 1, y: 2, zoom: 3 } },
      { mediaId: "m2", url: "http://x/t2.jpg", position: undefined },
    ]);
  });
});

describe("buildTagOptions", () => {
  const tags = [tag("a", "Ярмарка"), tag("b", "Бусины"), tag("c", "Вязание")];
  const resolveTitle = (name: Record<string, string>) => name.ru;

  it("puts the category's suggested tags first, starred, then the rest alphabetically", () => {
    const options = buildTagOptions(tags, { tagsIds: ["c"] }, resolveTitle);
    expect(options).toEqual([
      { value: "c", label: "Вязание (★)" },
      { value: "b", label: "Бусины" },
      { value: "a", label: "Ярмарка" },
    ]);
  });

  it("sorts alphabetically with no active category", () => {
    expect(buildTagOptions(tags, undefined, resolveTitle).map((option) => option.value)).toEqual(["b", "c", "a"]);
  });
});

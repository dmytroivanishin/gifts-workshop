import { describe, it, expect } from "vitest";
import {
  isPlaceholderSlug,
  isPlaceholderTitle,
  nextPlaceholderNumber,
  placeholderSlug,
  placeholderTitle,
} from "@/utils/placeholderPost";

describe("isPlaceholderSlug (the form's Создать/Редактировать check)", () => {
  it.each([
    ["untitled-1", true],
    ["untitled-10", true],
    ["untitled-1-2", false], // a suffixed slug is a real name that collided, not a placeholder
    ["untitled-bear", false], // a creative title that starts with the word
    ["untitled", false],
    ["zayka", false],
    ["", false],
  ])("%s -> %s", (slug, expected) => {
    expect(isPlaceholderSlug(slug)).toBe(expected);
  });

  it("is false for an undefined slug (a post that is not loaded yet)", () => {
    expect(isPlaceholderSlug(undefined)).toBe(false);
  });
});

describe("isPlaceholderTitle (the publish warning check)", () => {
  it.each([
    ["Без названия #1", true],
    ["Без названия #12", true],
    ["Без названия #1 ", false],
    ["Без названия", false],
    ["Untitled 1", false], // a typed title is not the template, only the untitled-N slug is special
    [undefined, false],
  ])("%s -> %s", (title, expected) => {
    expect(isPlaceholderTitle(title)).toBe(expected);
  });
});

describe("placeholderSlug / placeholderTitle", () => {
  it("builds the slug and the Russian title from one number", () => {
    expect(placeholderSlug(3)).toBe("untitled-3");
    expect(placeholderTitle(3)).toBe("Без названия #3");
  });
});

describe("nextPlaceholderNumber (max + 1 over every post, not only drafts)", () => {
  it("starts at 1 when there are no placeholders", () => {
    expect(nextPlaceholderNumber([])).toBe(1);
  });

  it("is one above the only placeholder", () => {
    expect(nextPlaceholderNumber(["untitled-1"])).toBe(2);
  });

  it("is above the highest, not the count: [1, 2, 10] gives 11", () => {
    expect(nextPlaceholderNumber(["untitled-1", "untitled-2", "untitled-10"])).toBe(11);
  });

  it("does not reuse a gap while a higher number exists: 1 renamed away, 10 still there -> 11", () => {
    const slugsAfterRenamingOne = ["untitled-2", "untitled-3", "untitled-10"];
    expect(nextPlaceholderNumber(slugsAfterRenamingOne)).toBe(11);
  });

  it("restarts at 1 only when every placeholder is gone", () => {
    expect(nextPlaceholderNumber(["zayka", "bunny"])).toBe(1);
  });

  it("ignores suffixed slugs (untitled-1-2) so they never raise the count", () => {
    expect(nextPlaceholderNumber(["untitled-1-2"])).toBe(1);
    expect(nextPlaceholderNumber(["untitled-1-2", "untitled-1"])).toBe(2);
  });

  it("counts a placeholder that was published or archived unrenamed (any status)", () => {
    // The counter sees every post's slug, so an old published placeholder is never reused.
    expect(nextPlaceholderNumber(["untitled-4"])).toBe(5);
  });

  it("ignores slugs that only contain the word (untitled-bear, untitled)", () => {
    expect(nextPlaceholderNumber(["untitled-bear", "untitled", "zayka"])).toBe(1);
  });
});

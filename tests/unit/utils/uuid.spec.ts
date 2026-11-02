import { describe, it, expect } from "vitest";
import { isUUID } from "@/utils/uuid";

describe("isUUID", () => {
  it("accepts a real v4 UUID", () => {
    expect(isUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUUID("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isUUID("")).toBe(false);
  });

  it("rejects a UUID with extra characters or whitespace", () => {
    expect(isUUID(" 123e4567-e89b-12d3-a456-426614174000")).toBe(false);
    expect(isUUID("123e4567-e89b-12d3-a456-426614174000 ")).toBe(false);
    expect(isUUID("123e4567-e89b-12d3-a456-426614174000x")).toBe(false);
  });

  it("rejects a slug-shaped string", () => {
    expect(isUUID("my-category-slug")).toBe(false);
  });
});

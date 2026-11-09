import { describe, it, expect } from "vitest";
import { getPaginationParams, getSearchParam, MAX_PAGE_SIZE } from "@/utils/paginationUtils";

const req = (query = ""): Request => new Request(`http://localhost/api/v1/posts${query}`);

describe("getPaginationParams", () => {
  it("returns undefined/undefined with no query params and no defaults", () => {
    expect(getPaginationParams(req())).toEqual({ page: undefined, limit: undefined });
  });

  it("returns the defaults when no query params are present", () => {
    expect(getPaginationParams(req(), 1, 20)).toEqual({ page: 1, limit: 20 });
  });

  it("parses valid page/limit query params", () => {
    expect(getPaginationParams(req("?page=3&limit=10"))).toEqual({ page: 3, limit: 10 });
  });

  it("falls back to defaultPage when page is non-numeric", () => {
    expect(getPaginationParams(req("?page=abc"), 1, 20)).toEqual({ page: 1, limit: 20 });
  });

  it("falls back to defaultPage when page is less than 1", () => {
    expect(getPaginationParams(req("?page=0"), 1, 20)).toEqual({ page: 1, limit: 20 });
  });

  it("caps an explicit limit query param at MAX_PAGE_SIZE", () => {
    expect(getPaginationParams(req(`?limit=${MAX_PAGE_SIZE + 500}`))).toEqual({
      page: undefined,
      limit: MAX_PAGE_SIZE,
    });
  });

  it("caps defaultLimit too when it exceeds MAX_PAGE_SIZE and no limit param is given", () => {
    expect(getPaginationParams(req(), 1, MAX_PAGE_SIZE + 50)).toEqual({ page: 1, limit: MAX_PAGE_SIZE });
  });

  // Documents a real, non-obvious asymmetry in the current implementation (not fixed here, just
  // pinned down): an *invalid* limit query param falls straight back to the raw defaultLimit
  // without re-running it through the Math.min cap — unlike the "no limit param at all" case
  // above, where defaultLimit passes through the capping branch and does get capped. Same
  // defaultLimit, different outcome depending on whether a bad limit= was present at all.
  it("does NOT cap defaultLimit when limit is present but non-numeric (known asymmetry)", () => {
    expect(getPaginationParams(req("?limit=abc"), 1, MAX_PAGE_SIZE + 50)).toEqual({
      page: 1,
      limit: MAX_PAGE_SIZE + 50,
    });
  });

  it("falls back to defaultLimit when limit is less than 1", () => {
    expect(getPaginationParams(req("?limit=0"), 1, 20)).toEqual({ page: 1, limit: 20 });
  });
});

describe("getSearchParam", () => {
  it("returns undefined when the param is missing or empty", () => {
    expect(getSearchParam(req())).toBeUndefined();
    expect(getSearchParam(req("?search="))).toBeUndefined();
  });

  it("returns the term as given when it is short", () => {
    expect(getSearchParam(req("?search=teddy"))).toBe("teddy");
  });

  it("cuts a very long term to 100 characters", () => {
    expect(getSearchParam(req(`?search=${"a".repeat(500)}`))).toHaveLength(100);
  });
});

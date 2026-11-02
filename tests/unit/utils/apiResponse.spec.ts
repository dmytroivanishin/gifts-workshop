import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/modules/logger", () => ({
  logger: { error: vi.fn() },
}));

import { sendSuccess, sendError, withErrorHandling } from "@/utils/apiResponse";
import { logger } from "@/modules/logger";
import { ValidationError } from "@/common/errors/validation";
import { NextResponse } from "next/server";

describe("sendSuccess", () => {
  it("omits meta from the payload when not given", async () => {
    const res = sendSuccess({ id: "1" });
    const body = await res.json();
    expect(body).toEqual({ data: { id: "1" } });
    expect("meta" in body).toBe(false);
  });

  it("includes meta when given", async () => {
    const res = sendSuccess([1, 2], { page: 1 });
    const body = await res.json();
    expect(body).toEqual({ data: [1, 2], meta: { page: 1 } });
  });

  it("sets Cache-Control when cacheSeconds is given", () => {
    const res = sendSuccess({}, undefined, 60);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=300");
  });

  it("sets no Cache-Control header when cacheSeconds is omitted", () => {
    const res = sendSuccess({});
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("sets no Cache-Control header when cacheSeconds is 0", () => {
    const res = sendSuccess({}, undefined, 0);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });
});

describe("sendError", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  it("uses the error's own status/code/message for a BaseError", async () => {
    const error = new ValidationError("bad input", [{ field: "name", message: "required" }]);
    const res = sendError(error);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      data: {},
      error: { code: "VALIDATION_ERROR", message: "bad input", details: [{ field: "name", message: "required" }] },
    });
    expect(logger.error).toHaveBeenCalledWith("bad input", expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("maps a non-BaseError to a generic 500 without leaking the raw message into the response", async () => {
    const error = new Error("SELECT * FROM posts WHERE secret_column = 'x'");
    const res = sendError(error);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ data: {}, error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" } });
    // the raw message is only ever passed to the logger, never put in the response body
    expect(logger.error).toHaveBeenCalledWith(error.message, expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }));
  });

  it("handles a thrown non-Error value (e.g. a plain string) the same way", async () => {
    const res = sendError("just a string");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(logger.error).toHaveBeenCalledWith("An unexpected error occurred", expect.anything());
  });
});

describe("withErrorHandling", () => {
  it("passes through a successful handler's result unchanged", async () => {
    const handler = withErrorHandling(async (x: number) => NextResponse.json({ data: x }));
    const res = await handler(5);
    expect(await res.json()).toEqual({ data: 5 });
  });

  it("catches a thrown error and converts it via sendError", async () => {
    const handler = withErrorHandling(async () => {
      throw new ValidationError("nope");
    });
    const res = await handler();
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("nope");
  });
});

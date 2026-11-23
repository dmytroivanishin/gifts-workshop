import { describe, expect, it } from "vitest";
import { clientDisconnectFields, describeRequestError } from "@/utils/requestErrorLog";

const context = { routerKind: "App Router", routePath: "/api/v1/media", routeType: "route" };

describe("describeRequestError", () => {
  it("logs a client that closed the connection as a warning, without a stack", () => {
    const error = Object.assign(new Error("aborted"), { code: "ECONNRESET" });
    const entry = describeRequestError(error, { path: "/api/v1/media", method: "POST" }, context);
    expect(entry.level).toBe("warn");
    expect(entry.code).toBe("CLIENT_DISCONNECTED");
    expect(entry.fields).not.toHaveProperty("stack");
  });

  it("treats a bare 'aborted' message as a disconnect too", () => {
    const entry = describeRequestError(new Error("aborted"), { path: "/x", method: "POST" }, context);
    expect(entry.code).toBe("CLIENT_DISCONNECTED");
  });

  it("logs a real failure as an error with its message and stack", () => {
    const error = new Error("disk full");
    const entry = describeRequestError(error, { path: "/api/v1/media", method: "POST" }, context);
    expect(entry.level).toBe("error");
    expect(entry.code).toBe("REQUEST_FAILED");
    expect(entry.message).toBe("disk full");
    expect(entry.fields.stack).toBe(error.stack);
  });

  it("handles a thrown non-Error value without crashing", () => {
    const entry = describeRequestError("boom", { path: "/x", method: "GET" }, context);
    expect(entry.message).toBe("boom");
    expect(entry.fields.stack).toBeUndefined();
  });

  it("keeps Next's digest when the error carries one", () => {
    const error = Object.assign(new Error("render failed"), { digest: "12345" });
    const entry = describeRequestError(error, { path: "/x", method: "GET" }, context);
    expect(entry.fields.digest).toBe("12345");
  });

  it("drops the query string, which can hold a search term", () => {
    const entry = describeRequestError(new Error("x"), { path: "/api/v1/posts?search=secret-term", method: "GET" }, context);
    expect(entry.fields.path).toBe("/api/v1/posts");
    expect(JSON.stringify(entry)).not.toContain("secret-term");
  });

  it("never includes request headers, which carry the admin cookie", () => {
    const request = { path: "/api/v1/media", method: "POST", headers: { cookie: "accessToken=abc" } } as {
      path: string;
      method: string;
    };
    const entry = describeRequestError(new Error("x"), request, context);
    expect(JSON.stringify(entry)).not.toContain("accessToken");
  });

  it("uses the same field names for a disconnect seen by a request and by the process", () => {
    const fromRequest = describeRequestError(
      Object.assign(new Error("aborted"), { code: "ECONNRESET" }),
      { path: "/api/v1/media", method: "POST" },
      context
    );
    const fromProcess = clientDisconnectFields({ origin: "uncaughtException", errorMessage: "aborted" });
    expect(Object.keys(fromRequest.fields).sort()).toEqual(Object.keys(fromProcess).sort());
  });
});

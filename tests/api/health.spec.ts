import { test, expect, APIRequestContext } from "@playwright/test";
import { anonContext } from "./helpers/auth";

const FILE_KEY = "health";

test.describe("health", () => {
  let anon: APIRequestContext;

  test.beforeAll(async () => {
    anon = await anonContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await anon.dispose();
  });

  test("answers 200 {status: ok} to an anonymous caller and is never cached", async () => {
    const res = await anon.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers()["cache-control"]).toBe("no-store");
  });
});

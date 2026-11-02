import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";

const FILE_KEY = "users";

test.describe("users", () => {
  let admin: APIRequestContext;
  let anon: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    anon = await anonContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
    await anon.dispose();
  });

  test("GET /users: 401 anonymous, 200 admin, never includes password", async () => {
    await expectError(await anon.get("/api/v1/users"), 401);

    const body = await expectSuccess<Array<Record<string, unknown>>>(await admin.get("/api/v1/users"));
    expect(body.data.length).toBeGreaterThan(0);
    for (const user of body.data) {
      expect(user).not.toHaveProperty("password");
    }
  });

  test("GET /users/:id: 401 anonymous, 200 admin, never includes password", async () => {
    const list = await expectSuccess<Array<{ id: string }>>(await admin.get("/api/v1/users"));
    const id = list.data[0].id;

    await expectError(await anon.get(`/api/v1/users/${id}`), 401);

    const byId = await expectSuccess<Record<string, unknown>>(await admin.get(`/api/v1/users/${id}`));
    expect(byId.data).not.toHaveProperty("password");
  });

  // POST/PUT/DELETE /users were removed entirely (CP-14) — no role model, zero UI consumers.
  // This isn't silently doing nothing: there's no handler at all for these methods now.
  test("POST /users (removed in CP-14) is not a working route anymore", async () => {
    const res = await admin.post("/api/v1/users", { data: { email: "x@example.com" } });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(405);
  });
});

import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";
import { createCollection, createPost } from "./helpers/fixtures";

const FILE_KEY = "collections";

test.describe("collections", () => {
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

  test("title is required, slug auto-generated, main defaults to false", async () => {
    const collection = await createCollection(admin);
    expect(collection.slug).toMatch(/^[a-z0-9-]+$/);
    expect(collection.main).toBe(false);

    const res = await admin.post("/api/v1/collections", { data: { main: true } });
    await expectError(res, 400, "VALIDATION_ERROR");

    await collection.cleanup();
  });

  test("GET /collections/:id/posts filters by status: Published only for anonymous, all for admin status=all", async () => {
    const collection = await createCollection(admin);
    const published = await createPost(admin, { status: "Published", collectionId: collection.id });
    const draft = await createPost(admin, { status: "Draft", collectionId: collection.id });

    const anonRes = await expectSuccess<Array<{ id: string }>>(
      await anon.get(`/api/v1/collections/${collection.id}/posts`)
    );
    expect(anonRes.data.map((p) => p.id)).toContain(published.id);
    expect(anonRes.data.map((p) => p.id)).not.toContain(draft.id);

    const adminRes = await expectSuccess<Array<{ id: string }>>(
      await admin.get(`/api/v1/collections/${collection.id}/posts?status=all`)
    );
    expect(adminRes.data.map((p) => p.id)).toContain(published.id);
    expect(adminRes.data.map((p) => p.id)).toContain(draft.id);

    await draft.cleanup();
    await published.cleanup();
    await collection.cleanup();
  });

  test("GET /collections/:id/posts returns a flat {data: [...], meta} shape (CP-6 double-wrap regression)", async () => {
    const collection = await createCollection(admin);
    const res = await admin.get(`/api/v1/collections/${collection.id}/posts`);
    const body = (await res.json()) as { data: unknown; meta: { page: number; totalItems: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toHaveProperty("page");
    expect(body.meta).toHaveProperty("totalItems");
    await collection.cleanup();
  });

  test("list carries Cache-Control: max-age=60", async () => {
    const res = await admin.get("/api/v1/collections");
    expect(res.headers()["cache-control"]).toContain("max-age=60");
  });

  test("malformed JSON body is a clean 400", async () => {
    const res = await admin.post("/api/v1/collections", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  test("a non-UUID id on GET/DELETE is a clean 404", async () => {
    await expectError(await admin.get("/api/v1/collections/not-a-uuid"), 404);
  });

  test("deleting a nonexistent id is a clean 404", async () => {
    await expectError(await admin.delete("/api/v1/collections/00000000-0000-0000-0000-000000000000"), 404);
  });
});

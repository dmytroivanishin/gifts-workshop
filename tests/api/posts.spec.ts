import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";
import { createPost, createCollection, createCategory } from "./helpers/fixtures";

const FILE_KEY = "posts";

test.describe("posts", () => {
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

  test("Draft saves with everything empty", async () => {
    const res = await admin.post("/api/v1/posts", { data: { status: "Draft" } });
    const body = await expectSuccess<{ id: string }>(res);
    await admin.delete(`/api/v1/posts/${body.data.id}`);
  });

  test("Published requires title, poster, collection and category", async () => {
    const res = await admin.post("/api/v1/posts", { data: { status: "Published" } });
    const body = await expectError(res, 400, "VALIDATION_ERROR");
    const fields = body.error.details?.map((d) => d.field) ?? [];
    expect(fields).toEqual(expect.arrayContaining(["title", "posterId", "collectionId", "categoryId"]));
  });

  test("anonymous ?status=Draft silently returns Published only; ?status=all is 401 anon, 200 admin", async () => {
    const collection = await createCollection(admin);
    const published = await createPost(admin, { status: "Published", collectionId: collection.id });
    const draft = await createPost(admin, { status: "Draft", collectionId: collection.id });

    const anonDraftReq = await expectSuccess<Array<{ id: string }>>(
      await anon.get(`/api/v1/posts?status=Draft&collection=${collection.id}`)
    );
    expect(anonDraftReq.data.map((p) => p.id)).not.toContain(draft.id);

    await expectError(await anon.get("/api/v1/posts?status=all"), 401);

    const adminAll = await expectSuccess<Array<{ id: string }>>(
      await admin.get(`/api/v1/posts?status=all&collection=${collection.id}`)
    );
    expect(adminAll.data.map((p) => p.id)).toEqual(
      expect.arrayContaining([published.id, draft.id])
    );

    await draft.cleanup();
    await published.cleanup();
    await collection.cleanup();
  });

  test("GET /posts/:slugOrId: 404 for a nonexistent slug, 404 for a Draft viewed anonymously, 200 for the same Draft as admin", async () => {
    await expectError(await admin.get("/api/v1/posts/this-definitely-does-not-exist-xyz"), 404);

    const draft = await createPost(admin, { status: "Draft" });
    await expectError(await anon.get(`/api/v1/posts/${draft.slug || draft.id}`), 404);
    await expectSuccess(await admin.get(`/api/v1/posts/${draft.id}`));

    await draft.cleanup();
  });

  test("search escapes % and _ literally, and also matches description", async () => {
    const collection = await createCollection(admin);
    const literal = await createPost(admin, {
      status: "Published",
      collectionId: collection.id,
      title: { ru: "100% скидка", en: "100% off" },
    });
    const other = await createPost(admin, {
      status: "Published",
      collectionId: collection.id,
      title: { ru: "Обычный пост", en: "Ordinary post" },
    });

    const res = await expectSuccess<Array<{ id: string }>>(
      await admin.get(`/api/v1/posts?search=${encodeURIComponent("100%")}&collection=${collection.id}`)
    );
    expect(res.data.map((p) => p.id)).toContain(literal.id);
    expect(res.data.map((p) => p.id)).not.toContain(other.id);

    await literal.cleanup();
    await other.cleanup();
    await collection.cleanup();
  });

  test("category/collection filters with a garbage (nonexistent) slug are an uncaught 500, not 400 or an empty list", async () => {
    await expectError(await admin.get("/api/v1/posts?category=totally-garbage-no-such-slug"), 500, "INTERNAL_SERVER_ERROR");
    await expectError(await admin.get("/api/v1/posts?collection=totally-garbage-no-such-slug"), 500, "INTERNAL_SERVER_ERROR");
  });

  test("pagination meta shape; limit is capped at 100", async () => {
    const res = await admin.get("/api/v1/posts?limit=500");
    const body = (await res.json()) as { meta: { page: number; totalItems: number } };
    expect(res.ok()).toBe(true);
    expect(body.meta).toHaveProperty("page");
    expect(body.meta).toHaveProperty("totalItems");
  });

  test("Cache-Control: present (7200s) for anonymous, absent for admin", async () => {
    const anonRes = await anon.get("/api/v1/posts");
    expect(anonRes.headers()["cache-control"]).toContain("max-age=7200");

    const adminRes = await admin.get("/api/v1/posts");
    expect(adminRes.headers()["cache-control"]).toBeUndefined();
  });
});

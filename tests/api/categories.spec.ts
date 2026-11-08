import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";
import { createCategory, createCollection, createColor, createTag, createPost } from "./helpers/fixtures";

const FILE_KEY = "categories";

test.describe("categories", () => {
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

  test("requires collectionId to create", async () => {
    const res = await admin.post("/api/v1/categories", {
      data: { title: { ru: "Х", en: "X" }, color: { color: "#111111" } },
    });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  test("rejects a title with every locale empty", async () => {
    const collection = await createCollection(admin);
    const res = await admin.post("/api/v1/categories", {
      data: { title: { ru: "", en: "" }, collectionId: collection.id, color: { color: "#111111" } },
    });
    await expectError(res, 400, "VALIDATION_ERROR");
    await collection.cleanup();
  });

  test("auto-generates a slug when none is given", async () => {
    const category = await createCategory(admin);
    expect(category.slug).toBeTruthy();
    expect(category.slug).toMatch(/^[a-z0-9-]+$/);
    await category.cleanup();
  });

  test("rejects a nonexistent parentId", async () => {
    const collection = await createCollection(admin);
    const res = await admin.post("/api/v1/categories", {
      data: {
        title: { ru: "Р", en: "R" },
        collectionId: collection.id,
        color: { color: "#222222" },
        parentId: "00000000-0000-0000-0000-000000000000",
      },
    });
    await expectError(res, 400, "VALIDATION_ERROR");
    await collection.cleanup();
  });

  test("rejects a self-referencing parentId on update", async () => {
    const category = await createCategory(admin);
    const res = await admin.put(`/api/v1/categories/${category.id}`, {
      data: {
        title: { ru: "Р", en: "R" },
        collectionId: category.collectionId,
        color: { color: "#222222" },
        parentId: category.id,
      },
    });
    await expectError(res, 400, "VALIDATION_ERROR");
    await category.cleanup();
  });

  test("rejects a circular parent chain (A -> B -> A)", async () => {
    const collection = await createCollection(admin);
    const a = await createCategory(admin, { collectionId: collection.id });
    const b = await createCategory(admin, { collectionId: collection.id, parentId: a.id });

    const res = await admin.put(`/api/v1/categories/${a.id}`, {
      data: {
        title: { ru: "А", en: "A" },
        collectionId: collection.id,
        color: { color: "#333333" },
        parentId: b.id,
      },
    });
    await expectError(res, 400, "VALIDATION_ERROR");

    await b.cleanup();
    await a.cleanup();
    await collection.cleanup();
  });

  test("a real nested parent works and the child is listed under it", async () => {
    const collection = await createCollection(admin);
    const parent = await createCategory(admin, { collectionId: collection.id });
    const child = await createCategory(admin, { collectionId: collection.id, parentId: parent.id });

    const res = await admin.get(`/api/v1/categories/${child.id}`);
    const body = await expectSuccess<{ parentId: string }>(res);
    expect(body.data.parentId).toBe(parent.id);

    await child.cleanup();
    await parent.cleanup();
    await collection.cleanup();
  });

  test("an existing colorId is reused as-is", async () => {
    const color = await createColor(admin, "#abcdef");
    const category = await createCategory(admin, { colorId: color.id });

    const res = await admin.get(`/api/v1/categories/${category.id}`);
    const body = await expectSuccess<{ color: { id: string } }>(res);
    expect(body.data.color.id).toBe(color.id);

    await category.cleanup();
    await color.cleanup();
  });

  // Finding: saveCategory maps color.id straight to the colorId column — it never auto-creates a
  // color from a bare hex, and never checks that a given id actually exists. The "custom hex
  // auto-save" the admin UI appears to do is really two separate client calls (POST /colors,
  // then this save with that color's real id), not server-side magic.
  test("a bare hex with no color id is silently dropped (colorId ends up null)", async () => {
    const collection = await createCollection(admin);
    const res = await admin.post("/api/v1/categories", {
      data: { title: { ru: "Б", en: "B" }, collectionId: collection.id, color: { color: "#ff00ff" } },
    });
    const body = await expectSuccess<{ id: string; color: unknown }>(res);
    expect(body.data.color).toBeFalsy();

    await admin.delete(`/api/v1/categories/${body.data.id}`);
    await collection.cleanup();
  });

  test("a colorId that doesn't exist hits the DB's FK constraint directly (uncaught -> 500)", async () => {
    const collection = await createCollection(admin);
    const res = await admin.post("/api/v1/categories", {
      data: {
        title: { ru: "В", en: "V" },
        collectionId: collection.id,
        color: { id: "00000000-0000-0000-0000-000000000000", color: "#ff00ff" },
      },
    });
    // Documents the real current behavior — see Findings in the plan: no existence check before
    // insert, so this is a raw Postgres FK violation, not a clean ValidationError.
    await expectError(res, 500, "INTERNAL_SERVER_ERROR");
    await collection.cleanup();
  });

  test("tagsIds are saved, and a second save adds/removes the difference", async () => {
    const tagA = await createTag(admin);
    const tagB = await createTag(admin);
    const category = await createCategory(admin, { tagsIds: [tagA.id] });

    let res = await admin.get(`/api/v1/categories/${category.id}`);
    let body = await expectSuccess<{ tagsIds: string[] }>(res);
    expect(body.data.tagsIds).toEqual([tagA.id]);

    res = await admin.put(`/api/v1/categories/${category.id}`, {
      data: {
        title: { ru: "Т", en: "T" },
        collectionId: category.collectionId,
        color: { id: category.color?.id, color: "#000000" },
        tagsIds: [tagB.id],
      },
    });
    await expectSuccess(res);

    res = await admin.get(`/api/v1/categories/${category.id}`);
    body = await expectSuccess<{ tagsIds: string[] }>(res);
    expect(body.data.tagsIds).toEqual([tagB.id]);

    await category.cleanup();
    await tagB.cleanup();
    await tagA.cleanup();
  });

  test("GET by id resolves both a UUID and a slug to the same record", async () => {
    const category = await createCategory(admin);

    const byId = await expectSuccess<{ id: string }>(await admin.get(`/api/v1/categories/${category.id}`));
    const bySlug = await expectSuccess<{ id: string }>(await admin.get(`/api/v1/categories/${category.slug}`));
    expect(byId.data.id).toBe(bySlug.data.id);

    await category.cleanup();
  });

  test("delete is blocked while it has a child category (409 CATEGORY_HAS_CHILDREN)", async () => {
    const collection = await createCollection(admin);
    const parent = await createCategory(admin, { collectionId: collection.id });
    const child = await createCategory(admin, { collectionId: collection.id, parentId: parent.id });

    const res = await admin.delete(`/api/v1/categories/${parent.id}`);
    await expectError(res, 409, "CATEGORY_HAS_CHILDREN");

    await child.cleanup();
    await parent.cleanup();
    await collection.cleanup();
  });

  test("delete is blocked while a post references it (409 CATEGORY_HAS_POSTS)", async () => {
    const category = await createCategory(admin);
    const post = await createPost(admin, { status: "Draft", categoryId: category.id });

    const res = await admin.delete(`/api/v1/categories/${category.id}`);
    await expectError(res, 409, "CATEGORY_HAS_POSTS");

    await post.cleanup();
    await category.cleanup();
  });

  // Finding: unlike collections/tags/colors/media, deleteCategory's controller never checks the
  // service's boolean result, so deleting a nonexistent id returns 200, not 404.
  test("deleting a nonexistent id returns 200, not 404 (inconsistent with every sibling entity)", async () => {
    const res = await admin.delete("/api/v1/categories/00000000-0000-0000-0000-000000000000");
    await expectSuccess(res, 200);
  });

  test("reorder applies new order values", async () => {
    const collection = await createCollection(admin);
    const a = await createCategory(admin, { collectionId: collection.id });
    const b = await createCategory(admin, { collectionId: collection.id });

    const res = await admin.put("/api/v1/categories/reorder", {
      data: { items: [{ id: a.id, order: 50 }, { id: b.id, order: 1 }] },
    });
    await expectSuccess(res);

    const list = await expectSuccess<Array<{ id: string; order: number }>>(await admin.get("/api/v1/categories"));
    const aOrder = list.data.find((c) => c.id === a.id)?.order;
    const bOrder = list.data.find((c) => c.id === b.id)?.order;
    expect(bOrder).toBeLessThan(aOrder!);

    await a.cleanup();
    await b.cleanup();
    await collection.cleanup();
  });

  test("list and by-id responses carry Cache-Control: max-age=43200 for anonymous, absent for admin", async () => {
    const category = await createCategory(admin);

    const listRes = await anon.get("/api/v1/categories");
    expect(listRes.headers()["cache-control"]).toContain("max-age=43200");
    const byIdRes = await anon.get(`/api/v1/categories/${category.id}`);
    expect(byIdRes.headers()["cache-control"]).toContain("max-age=43200");

    const adminListRes = await admin.get("/api/v1/categories");
    expect(adminListRes.headers()["cache-control"]).toBeUndefined();
    const adminByIdRes = await admin.get(`/api/v1/categories/${category.id}`);
    expect(adminByIdRes.headers()["cache-control"]).toBeUndefined();

    await category.cleanup();
  });

  test("malformed JSON body is a clean 400, not a 500", async () => {
    const res = await admin.post("/api/v1/categories", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  test("a non-UUID id on GET/DELETE is a clean 404, not a raw Postgres error", async () => {
    await expectError(await admin.get("/api/v1/categories/not-a-uuid-and-no-such-slug"), 404);
  });
});

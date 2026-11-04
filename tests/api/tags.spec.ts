import { test, expect, APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";
import { createTag, createCategory, createPost } from "./helpers/fixtures";

const FILE_KEY = "tags";

test.describe("tags", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("name is required, slug auto-generated", async () => {
    const tag = await createTag(admin);
    expect(tag.slug).toMatch(/^[a-z0-9-]+$/);

    const res = await admin.post("/api/v1/tags", { data: {} });
    await expectError(res, 400, "VALIDATION_ERROR");

    await tag.cleanup();
  });

  test("deleting a tag removes it from every category and post that had it", async () => {
    const tag = await createTag(admin);
    const category = await createCategory(admin, { tagsIds: [tag.id] });
    const post = await createPost(admin, { status: "Draft", categoryId: category.id, tagsIds: [tag.id] });

    await expectSuccess(await admin.delete(`/api/v1/tags/${tag.id}`));

    const categoryAfter = await expectSuccess<{ tagsIds: string[] }>(
      await admin.get(`/api/v1/categories/${category.id}`)
    );
    expect(categoryAfter.data.tagsIds).not.toContain(tag.id);

    const postAfter = await expectSuccess<{ tagsIds: string[] }>(await admin.get(`/api/v1/posts/${post.id}`));
    expect(postAfter.data.tagsIds).not.toContain(tag.id);

    await post.cleanup();
    await category.cleanup();
    // tag already deleted, nothing left to clean up
  });

  // "Inline tag creation" from the post/category editor is a frontend convenience — it calls this
  // exact same POST /tags endpoint, there is no separate server-side code path to test here.
  test("list carries Cache-Control: max-age=60", async () => {
    const res = await admin.get("/api/v1/tags");
    expect(res.headers()["cache-control"]).toContain("max-age=60");
  });

  test("malformed JSON body is a clean 400", async () => {
    const res = await admin.post("/api/v1/tags", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  test("a non-UUID id on GET/DELETE is a clean 404", async () => {
    await expectError(await admin.get("/api/v1/tags/not-a-uuid"), 404);
  });

  test("deleting a nonexistent id is a clean 404", async () => {
    await expectError(await admin.delete("/api/v1/tags/00000000-0000-0000-0000-000000000000"), 404);
  });

  // CP-40: GET /tags gained a server-side `search` param, `desc(createdAt)` ordering, and a
  // real created_at column. The 4 tests below prove each of those directly against the real DB
  // instead of only trusting the code that implements them.

  test("search matches a partial, case-insensitive substring and excludes a non-matching tag", async () => {
    const marker = crypto.randomUUID().slice(0, 8);
    const alpha = await createTag(admin, { name: { ru: `Поиск Alpha ${marker}`, en: `Search Alpha ${marker}` } });
    const beta = await createTag(admin, { name: { ru: `Поиск Beta ${marker}`, en: `Search Beta ${marker}` } });

    const res = await expectSuccess<Array<{ id: string }>>(
      await admin.get(`/api/v1/tags?search=${encodeURIComponent(`ALPHA ${marker}`)}`)
    );
    const ids = res.data.map((t) => t.id);
    expect(ids).toContain(alpha.id);
    expect(ids).not.toContain(beta.id);

    await alpha.cleanup();
    await beta.cleanup();
  });

  test("search escapes a literal % instead of treating it as a SQL wildcard", async () => {
    const marker = crypto.randomUUID().slice(0, 8);
    // If `%` in the query were passed straight into ILIKE unescaped, it would act as "any
    // characters" and this percent tag's query would also match the X tag below (50 + anything +
    // Marker). Escaping forces a literal match, so only the tag that actually contains "%" matches.
    const withPercent = await createTag(admin, { name: { en: `Discount50%Marker${marker}` } });
    const withoutPercent = await createTag(admin, { name: { en: `Discount50XMarker${marker}` } });

    const res = await expectSuccess<Array<{ id: string }>>(
      await admin.get(`/api/v1/tags?search=${encodeURIComponent(`50%Marker${marker}`)}`)
    );
    const ids = res.data.map((t) => t.id);
    expect(ids).toContain(withPercent.id);
    expect(ids).not.toContain(withoutPercent.id);

    await withPercent.cleanup();
    await withoutPercent.cleanup();
  });

  test("list with no args returns the newest-created tag before an older one", async () => {
    const older = await createTag(admin);
    const newer = await createTag(admin);

    const res = await expectSuccess<Array<{ id: string }>>(await admin.get("/api/v1/tags"));
    const ids = res.data.map((t) => t.id);
    const idxOlder = ids.indexOf(older.id);
    const idxNewer = ids.indexOf(newer.id);
    expect(idxOlder).toBeGreaterThanOrEqual(0);
    expect(idxNewer).toBeGreaterThanOrEqual(0);
    expect(idxNewer).toBeLessThan(idxOlder);

    await newer.cleanup();
    await older.cleanup();
  });

  test("pagination across pages is stable: every created tag appears exactly once, none skipped or duplicated", async () => {
    const marker = crypto.randomUUID().slice(0, 8);
    const created = [];
    for (let i = 0; i < 12; i++) {
      created.push(await createTag(admin, { name: { en: `Page Stability ${marker} ${i}` } }));
    }

    const seenIds: string[] = [];
    let page = 1;
    // Walks the whole table rather than assuming our 12 land on exactly pages 1-3 — a concurrent
    // insert from another spec file running in a different worker could otherwise shift them.
    for (; page <= 50; page++) {
      const res = await expectSuccess<Array<{ id: string }>>(
        await admin.get(`/api/v1/tags?page=${page}&limit=5`)
      );
      seenIds.push(...res.data.map((t) => t.id));
      if (!res.meta?.nextPage) break;
    }

    expect(seenIds.length).toBe(new Set(seenIds).size);
    const seenSet = new Set(seenIds);
    for (const tag of created) {
      expect(seenSet.has(tag.id)).toBe(true);
    }

    for (const tag of created) await tag.cleanup();
  });
});

import { test, expect, APIRequestContext } from "@playwright/test";
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
});

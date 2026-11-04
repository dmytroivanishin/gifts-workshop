import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";
import { createColor, createCategory } from "./helpers/fixtures";

const FILE_KEY = "colors";

test.describe("colors", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test("accepts 3- and 6-digit hex, rejects malformed hex", async () => {
    const three = await createColor(admin, "#abc");
    expect(three.color).toBe("#abc");
    const six = await createColor(admin, "#aabbcc");
    expect(six.color).toBe("#aabbcc");

    const res = await admin.post("/api/v1/colors", { data: { color: "not-a-hex" } });
    await expectError(res, 400, "VALIDATION_ERROR");

    await three.cleanup();
    await six.cleanup();
  });

  test("updating a color's hex propagates to every category referencing it", async () => {
    const color = await createColor(admin, "#111111");
    const category = await createCategory(admin, { colorId: color.id });

    const updateRes = await admin.put(`/api/v1/colors/${color.id}`, { data: { color: "#222222" } });
    await expectSuccess(updateRes);

    const categoryAfter = await expectSuccess<{ color: { color: string } }>(
      await admin.get(`/api/v1/categories/${category.id}`)
    );
    expect(categoryAfter.data.color.color).toBe("#222222");

    await category.cleanup();
    await color.cleanup();
  });

  // Finding: ColorService.deleteColor has no in-use check of its own (unlike categories/media,
  // which throw a clean 409 ConflictError) — it relies entirely on the DB's
  // color_id -> colors (restrict) FK. That violation isn't a BaseError, so sendError() turns it
  // into a generic 500, not a 409. This test documents the real current behavior.
  test("deleting a color still referenced by a category is an uncaught 500, not a clean 409", async () => {
    const color = await createColor(admin);
    const category = await createCategory(admin, { colorId: color.id });

    const res = await admin.delete(`/api/v1/colors/${color.id}`);
    await expectError(res, 500, "INTERNAL_SERVER_ERROR");

    await category.cleanup();
    await color.cleanup();
  });

  test("deleting an unused color succeeds", async () => {
    const color = await createColor(admin);
    await expectSuccess(await admin.delete(`/api/v1/colors/${color.id}`));
  });

  test("list carries Cache-Control: max-age=60", async () => {
    const res = await admin.get("/api/v1/colors");
    expect(res.headers()["cache-control"]).toContain("max-age=60");
  });

  test("malformed JSON body is a clean 400", async () => {
    const res = await admin.post("/api/v1/colors", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });
    await expectError(res, 400, "VALIDATION_ERROR");
  });

  test("a non-UUID id on GET/DELETE is a clean 404", async () => {
    await expectError(await admin.get("/api/v1/colors/not-a-uuid"), 404);
  });

  test("deleting a nonexistent id is a clean 404", async () => {
    await expectError(await admin.delete("/api/v1/colors/00000000-0000-0000-0000-000000000000"), 404);
  });

  // CP-40: colorService.getAllColors previously capped an argument-less call at 20 rows (unlike
  // tags/categories' "no args = everything" convention) — this is the direct regression test for
  // that fix. Uses a before/after delta rather than an absolute count so a concurrent insert from
  // another spec file running in a different worker can't make this flaky.
  test("list with no args returns more than 20 rows once more than 20 exist", async () => {
    const before = await expectSuccess<Array<{ id: string }>>(await admin.get("/api/v1/colors"));
    const baseline = before.data.length;

    const created = [];
    for (let i = 0; i < 22; i++) created.push(await createColor(admin));

    const after = await expectSuccess<Array<{ id: string }>>(await admin.get("/api/v1/colors"));
    expect(after.data.length).toBeGreaterThanOrEqual(baseline + 22);

    for (const c of created) await c.cleanup();
  });

  test("list with no args returns the newest-created color before an older one", async () => {
    const older = await createColor(admin);
    const newer = await createColor(admin);

    const res = await expectSuccess<Array<{ id: string }>>(await admin.get("/api/v1/colors"));
    const ids = res.data.map((c) => c.id);
    const idxOlder = ids.indexOf(older.id);
    const idxNewer = ids.indexOf(newer.id);
    expect(idxOlder).toBeGreaterThanOrEqual(0);
    expect(idxNewer).toBeGreaterThanOrEqual(0);
    expect(idxNewer).toBeLessThan(idxOlder);

    await newer.cleanup();
    await older.cleanup();
  });
});

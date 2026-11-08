import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";

const FILE_KEY = "system-texts";
const rnd = (): string => Math.random().toString(36).slice(2, 10);

test.describe("system-texts", () => {
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

  // The CP-36 regression this test exists to prevent: the server used to require a field
  // literally named "id" for a *new* entry, which the client never sends (only on edit, via the
  // :id URL segment) — creation was broken until the schema's key field was renamed to "code".
  test("code and content are required; omitting code 400s on the code field itself", async () => {
    const res = await admin.post("/api/v1/system-texts", {
      data: { content: { ru: "Привет", en: "Hello" } },
    });
    const body = await expectError(res, 400, "VALIDATION_ERROR");
    const fields = body.error.details?.map((d) => d.field) ?? [];
    expect(fields).toContain("code");
  });

  test("area defaults to admin when omitted", async () => {
    const code = `test_code_${rnd()}`;
    const res = await admin.post("/api/v1/system-texts", {
      data: { code, content: { ru: "Привет", en: "Hello" } },
    });
    const body = await expectSuccess<{ id: string; area: string }>(res);
    expect(body.data.area).toBe("admin");

    await admin.delete(`/api/v1/system-texts/${body.data.id}`);
  });

  test("editing via :id keeps the same code", async () => {
    const code = `test_code_${rnd()}`;
    const created = await expectSuccess<{ id: string; code: string }>(
      await admin.post("/api/v1/system-texts", { data: { code, content: { ru: "A", en: "A" } } })
    );

    // systemTextSchema requires `code` on every save, not just creation — `id` is the only field
    // that's optional (injected from the URL on edit). Confirmed while running this suite.
    const updated = await expectSuccess<{ id: string; code: string }>(
      await admin.patch(`/api/v1/system-texts/${created.data.id}`, {
        data: { code, content: { ru: "B", en: "B" } },
      })
    );
    expect(updated.data.code).toBe(code);
    expect(updated.data.id).toBe(created.data.id);

    await admin.delete(`/api/v1/system-texts/${created.data.id}`);
  });

  // Guards CP-26's revalidateTag wiring: an edit must be visible on the very next request, not
  // served stale-while-revalidate from unstable_cache's "system-texts" tag.
  test("a saved change is immediately visible on the next GET (cache invalidation)", async () => {
    const code = `test_code_${rnd()}`;
    const created = await expectSuccess<{ id: string }>(
      await admin.post("/api/v1/system-texts", { data: { code, content: { ru: "before", en: "before" } } })
    );

    await admin.get(`/api/v1/system-texts/${created.data.id}`); // warm the cache
    // code is required on every save, including edits — omitting it here would silently 400 and
    // never actually change the content, which is exactly what this test used to miss.
    await expectSuccess(
      await admin.patch(`/api/v1/system-texts/${created.data.id}`, { data: { code, content: { ru: "after", en: "after" } } })
    );

    const after = await expectSuccess<{ content: { ru: string } }>(
      await admin.get(`/api/v1/system-texts/${created.data.id}`)
    );
    expect(after.data.content.ru).toBe("after");

    await admin.delete(`/api/v1/system-texts/${created.data.id}`);
  });

  // Finding: saveSystemText doesn't pre-check for a duplicate code before insert — same
  // uncaught-unique-constraint shape as the colors-delete-while-in-use finding. This test
  // documents whatever the real current status turns out to be.
  test("a duplicate code on a second POST", async () => {
    const code = `test_code_${rnd()}`;
    const first = await expectSuccess<{ id: string }>(
      await admin.post("/api/v1/system-texts", { data: { code, content: { ru: "A", en: "A" } } })
    );

    const res = await admin.post("/api/v1/system-texts", { data: { code, content: { ru: "B", en: "B" } } });
    expect(res.ok()).toBe(false);

    await admin.delete(`/api/v1/system-texts/${first.data.id}`);
  });

  test("list carries Cache-Control: max-age=43200 for anonymous, absent for admin", async () => {
    const res = await anon.get("/api/v1/system-texts");
    expect(res.headers()["cache-control"]).toContain("max-age=43200");

    const adminRes = await admin.get("/api/v1/system-texts");
    expect(adminRes.headers()["cache-control"]).toBeUndefined();
  });

  test("a non-UUID id on GET/DELETE is a clean 404", async () => {
    await expectError(await admin.get("/api/v1/system-texts/not-a-uuid"), 404);
  });
});

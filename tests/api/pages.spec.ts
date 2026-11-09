import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectSuccess, expectError } from "./helpers/client";

const FILE_KEY = "pages";
const rnd = (): string => Math.random().toString(36).slice(2, 10);

interface PageBody {
  id: string;
  slug: string;
  title: Record<string, string>;
  description: Record<string, string>;
  showInMenu: boolean;
}

test.describe("pages", () => {
  let admin: APIRequestContext;
  let anon: APIRequestContext;
  const created: string[] = [];

  async function createPage(data: Record<string, unknown>): Promise<PageBody> {
    const body = await expectSuccess<PageBody>(await admin.post("/api/v1/pages", { data }));
    created.push(body.data.id);
    return body.data;
  }

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    anon = await anonContext(FILE_KEY);
  });

  test.afterAll(async () => {
    for (const id of created) await admin.delete(`/api/v1/pages/${id}`);
    await admin.dispose();
    await anon.dispose();
  });

  test("the description is stored exactly as typed: spaces, indents and blank lines survive", async () => {
    const text = "Line 1\n\n    indented   with   gaps\n\nlast";
    const page = await createPage({ title: { en: `Whitespace ${rnd()}` }, description: { en: text } });
    expect(page.description.en).toBe(text);

    const fetched = await expectSuccess<PageBody>(await anon.get(`/api/v1/pages/${page.id}`));
    expect(fetched.data.description.en).toBe(text);
  });

  test("slug is generated from the title, a taken slug gets a numeric suffix, an empty slug means generate", async () => {
    const title = `Slug Source ${rnd()}`;
    const first = await createPage({ title: { en: title }, slug: "" });
    expect(first.slug).toMatch(/^[a-z0-9-]+$/);

    const second = await createPage({ title: { en: title } });
    expect(second.slug).not.toBe(first.slug);
    expect(second.slug.startsWith(first.slug)).toBe(true);

    const explicit = await createPage({ title: { en: `Explicit ${rnd()}` }, slug: first.slug });
    expect(explicit.slug).not.toBe(first.slug);
  });

  test("an edit keeps the page's URL; PUT replaces the page (missing fields are reset)", async () => {
    const page = await createPage({ title: { en: `Edit ${rnd()}` }, description: { en: "old" }, showInMenu: true });
    const updated = await expectSuccess<PageBody>(
      await admin.put(`/api/v1/pages/${page.id}`, { data: { title: { en: "Renamed" }, showInMenu: false } })
    );
    expect(updated.data.slug).toBe(page.slug);
    expect(updated.data.title.en).toBe("Renamed");
    expect(updated.data.showInMenu).toBe(false);
    expect(updated.data.description).toEqual({});
  });

  test("a page can be read by slug as well as by id, and the list is public", async () => {
    const page = await createPage({ title: { en: `Lookup ${rnd()}` } });
    const bySlug = await expectSuccess<PageBody>(await anon.get(`/api/v1/pages/${page.slug}`));
    expect(bySlug.data.id).toBe(page.id);

    const list = await expectSuccess<PageBody[]>(await anon.get("/api/v1/pages"));
    expect(list.data.some((p) => p.id === page.id)).toBe(true);
  });

  test("validation: a title is required, a bad slug is rejected", async () => {
    await expectError(await admin.post("/api/v1/pages", { data: { title: {} } }), 400, "VALIDATION_ERROR");
    await expectError(await admin.post("/api/v1/pages", { data: { title: { en: "x" }, slug: "Not Valid!" } }), 400, "VALIDATION_ERROR");
  });

  test("writes need an admin; reading does not", async () => {
    await expectError(await anon.post("/api/v1/pages", { data: { title: { en: "x" } } }), 401);
    const page = await createPage({ title: { en: `Auth ${rnd()}` } });
    await expectError(await anon.put(`/api/v1/pages/${page.id}`, { data: { title: { en: "x" } } }), 401);
    await expectError(await anon.delete(`/api/v1/pages/${page.id}`), 401);
  });

  test("delete removes the page; a missing page is 404 (and a non-UUID, non-slug id too)", async () => {
    const page = await createPage({ title: { en: `Delete ${rnd()}` } });
    await expectSuccess(await admin.delete(`/api/v1/pages/${page.id}`));
    await expectError(await admin.get(`/api/v1/pages/${page.id}`), 404, "NOT_FOUND");
    await expectError(await admin.delete(`/api/v1/pages/${page.id}`), 404, "NOT_FOUND");
    await expectError(await anon.get("/api/v1/pages/does-not-exist-" + rnd()), 404, "NOT_FOUND");
  });

  test("slug suggestion endpoint: admin only, plain ASCII is formatted, other text gives a valid slug", async () => {
    await expectError(await anon.post("/api/v1/slugs", { data: { text: "Hello" } }), 401);

    const ascii = await expectSuccess<{ slug: string }>(await admin.post("/api/v1/slugs", { data: { text: "Hello World" } }));
    expect(ascii.data.slug).toBe("hello-world");

    // Cyrillic goes through the translation service or, offline, the transliteration fallback;
    // either way the result must be a usable slug.
    const cyrillic = await expectSuccess<{ slug: string }>(await admin.post("/api/v1/slugs", { data: { text: "Оплата и доставка" } }));
    expect(cyrillic.data.slug).toMatch(/^[a-z0-9-]+$/);

    const empty = await expectSuccess<{ slug: string }>(await admin.post("/api/v1/slugs", { data: { text: "   " } }));
    expect(empty.data.slug).toBe("");

    await expectError(await admin.post("/api/v1/slugs", { data: { text: "x".repeat(301) } }), 400, "VALIDATION_ERROR");
  });
});

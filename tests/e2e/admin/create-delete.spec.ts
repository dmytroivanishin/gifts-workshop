import { test, expect, APIRequestContext, Page, Response } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createCollection, createColor } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";
import { categoryRow } from "../helpers/categoryRows";

const FILE_KEY = "e2e-create-delete";

// CP-57: create and delete through the left form panel and the list's row buttons, for every
// entity that edits in that panel. Edit, cancel and delete-while-editing live in the
// <entity>-edit specs; this file covers the plain add flow and the plain row delete.
// The test DB's system_texts is empty, so t() renders raw keys.
test.describe("admin: create and delete through the left form panel", () => {
  let admin: APIRequestContext;
  const createdIds: { path: string; id: string }[] = [];

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterEach(async () => {
    // Best effort: the delete steps usually already removed these (a 404 here is fine).
    for (const { path, id } of createdIds.splice(0).reverse()) {
      await admin.delete(`/api/v1/${path}/${id}`);
    }
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  async function created(response: Response, path: string): Promise<string> {
    expect(response.status()).toBe(200);
    const data = (await response.json()).data;
    const id: string = Array.isArray(data) ? data[0].id : data.id;
    createdIds.push({ path, id });
    return id;
  }

  const isPost = (res: Response, path: string) =>
    new URL(res.url()).pathname === `/api/v1/${path}` && res.request().method() === "POST";

  async function gone(path: string, id: string): Promise<boolean> {
    return (await admin.get(`/api/v1/${path}/${id}`)).status() === 404;
  }

  const confirmDelete = (page: Page) => page.getByTestId("confirm-modal-confirm").click();

  test("tags: add a tag, then delete it from its row", async ({ page }) => {
    const name = `TagCreate ${crypto.randomUUID().slice(0, 8)}`;
    await loginAsAdmin(page);
    await page.goto("/admin/tags");

    await page.getByPlaceholder("placeholder_vintage").fill(name);
    const posted = page.waitForResponse((r) => isPost(r, "tags"));
    await page.getByRole("button", { name: "create_tag", exact: true }).click();
    const id = await created(await posted, "tags");

    const row = page.locator("div.p-4.h-full", { hasText: `#${name}` });
    await expect(row).toBeVisible();
    await expect(page.getByPlaceholder("placeholder_vintage")).toHaveValue("");
    expect((await (await admin.get(`/api/v1/tags/${id}`)).json()).data.name.ru).toBe(name);

    await row.getByTitle("delete_tag").click();
    await confirmDelete(page);
    await expect(row).toHaveCount(0);
    expect(await gone("tags", id)).toBe(true);
  });

  test("colors: add a colour, then delete it from its row", async ({ page }) => {
    const hex = "#" + crypto.randomBytes(3).toString("hex").toUpperCase();
    await loginAsAdmin(page);
    await page.goto("/admin/colors");

    await page.getByPlaceholder("#HEX").fill(hex);
    const posted = page.waitForResponse((r) => isPost(r, "colors"));
    await page.getByRole("button", { name: "add_color", exact: true }).click();
    const id = await created(await posted, "colors");

    const row = page.locator("div.p-4.h-full", { hasText: hex });
    await expect(row).toBeVisible();
    // The colour form resets to its default swatch (#FFD2D2), not to an empty field.
    await expect(page.getByPlaceholder("#HEX")).toHaveValue("#FFD2D2");

    await row.getByTitle("delete").click();
    await confirmDelete(page);
    await expect(row).toHaveCount(0);
    expect(await gone("colors", id)).toBe(true);
  });

  test("collections: add a collection, then delete it from its row", async ({ page }) => {
    const title = `ColCreate ${crypto.randomUUID().slice(0, 8)}`;
    await loginAsAdmin(page);
    await page.goto("/admin/collections");

    await page.getByPlaceholder("placeholder_collection_title").fill(title);
    await page.getByPlaceholder("placeholder_collection_desc").fill(`${title} description`);
    const posted = page.waitForResponse((r) => isPost(r, "collections"));
    await page.getByRole("button", { name: "add_collection", exact: true }).click();
    const id = await created(await posted, "collections");

    const row = page.locator("div.p-4.h-full", { hasText: title });
    await expect(row).toBeVisible();
    await expect(page.getByPlaceholder("placeholder_collection_title")).toHaveValue("");
    const saved = (await (await admin.get(`/api/v1/collections/${id}`)).json()).data;
    expect(saved.title.ru).toBe(title);
    expect(saved.description.ru).toBe(`${title} description`);
    expect(saved.main).toBe(false);

    await row.getByTitle("delete_collection").click();
    await confirmDelete(page);
    await expect(row).toHaveCount(0);
    expect(await gone("collections", id)).toBe(true);
  });

  test("categories: add a category (default collection and colour), then delete it from its row", async ({ page }) => {
    // The add form pre-selects the first collection and the first palette colour, so at least one
    // of each has to exist.
    const collection = await createCollection(admin);
    const color = await createColor(admin);
    const title = `CatCreate ${crypto.randomUUID().slice(0, 8)}`;

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      await page.getByPlaceholder("placeholder_category_title").fill(title);
      await page.getByPlaceholder("placeholder_category_desc").fill(`${title} description`);
      const submit = page.getByRole("button", { name: "add_category", exact: true });
      await expect(submit).toBeEnabled();
      const posted = page.waitForResponse((r) => isPost(r, "categories"));
      await submit.click();
      const id = await created(await posted, "categories");

      const titleSpan = page.locator("span.font-semibold.text-foreground.truncate", { hasText: title });
      await expect(titleSpan).toBeVisible();
      await expect(page.getByPlaceholder("placeholder_category_title")).toHaveValue("");
      const saved = (await (await admin.get(`/api/v1/categories/${id}`)).json()).data;
      expect(saved.title.ru).toBe(title);
      expect(saved.description.ru).toBe(`${title} description`);
      expect(saved.collectionId).toBeTruthy();
      expect(saved.color?.id).toBeTruthy();

      const row = categoryRow(page, title);
      await row.getByTitle("delete").click();
      await confirmDelete(page);
      await expect(titleSpan).toHaveCount(0);
      expect(await gone("categories", id)).toBe(true);
    } finally {
      // afterEach removes the category if a step failed; fixtures go after it.
      for (const { path, id } of createdIds.splice(0).reverse()) await admin.delete(`/api/v1/${path}/${id}`);
      await color.cleanup();
      await collection.cleanup();
    }
  });
});

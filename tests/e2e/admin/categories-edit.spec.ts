import { test, expect, APIRequestContext, Page } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createCategory, createColor, createTag } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";
import { comboboxTrigger, pickComboboxOption } from "../helpers/combobox";

const FILE_KEY = "e2e-categories-edit";

// CP-57: a category is edited in the left form panel (like collections), not inline in the list row.
// The category drag-and-drop tree is untouched. The test DB's system_texts is empty, so t() renders
// raw keys: headings are "edit_category" / "add_category", the submit button in edit mode "save".
test.describe("admin categories: edit through the left form panel", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  interface CategoryDto {
    title: Record<string, string>;
    description: Record<string, string>;
    collectionId: string;
    parentId: string | null;
    tagsIds: string[];
    color?: { id: string };
  }

  async function readCategory(id: string): Promise<CategoryDto> {
    const res = await admin.get(`/api/v1/categories/${id}`);
    return (await res.json()).data;
  }

  // The panel saves through POST /categories for add and edit alike (the id travels in the body).
  const isSave = (res: { url(): string; request(): { method(): string } }) =>
    new URL(res.url()).pathname === "/api/v1/categories" && res.request().method() === "POST";

  const titleSpan = (page: Page, title: string) =>
    page.locator("span.font-semibold.text-sm.text-foreground.truncate", { hasText: title });
  const rowFor = (page: Page, title: string) => page.locator("div.p-4.flex.flex-col", { has: titleSpan(page, title) });

  const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true });
  const titleInput = (page: Page) => page.getByPlaceholder("placeholder_category_title");
  const descInput = (page: Page) => page.getByPlaceholder("placeholder_category_desc");
  // Collection and parent category are Combobox fields (labelled by their translation keys).
  const parentField = (page: Page) => comboboxTrigger(page, "parent_category");
  const collectionField = (page: Page) => comboboxTrigger(page, "collections");

  test("edit loads every field into the panel, saving updates this locale only and keeps the rest", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const tag = await createTag(admin, { name: { ru: `CatEditTag ${marker}`, en: `CatEditTag EN ${marker}` } });
    const category = await createCategory(admin, {
      tagsIds: [tag.id],
      overrides: {
        title: { ru: `CatEdit Orig ${marker}`, en: `CatEdit English ${marker}` },
        description: { ru: `Desc Orig ${marker}`, en: `Desc English ${marker}` },
      },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      await expect(titleSpan(page, `CatEdit Orig ${marker}`)).toBeVisible();
      await expect(heading(page, "add_category")).toBeVisible();

      await rowFor(page, `CatEdit Orig ${marker}`).getByTitle("edit_category").click();
      await expect(heading(page, "edit_category")).toBeVisible();
      await expect(titleInput(page)).toHaveValue(`CatEdit Orig ${marker}`);
      await expect(descInput(page)).toHaveValue(`Desc Orig ${marker}`);
      // No parent: the field shows its placeholder. The collection shows the category's own collection.
      await expect(parentField(page)).toContainText("none_main_category");
      await expect(collectionField(page)).not.toContainText("placeholder_select_collection");
      // The category's tag shows up as a chip with its real name, not a raw id.
      await expect(page.locator("form").getByText(`CatEditTag ${marker}`)).toBeVisible();

      await titleInput(page).fill(`CatEdit Renamed ${marker}`);
      await descInput(page).fill(`Desc Renamed ${marker}`);
      const saved = page.waitForResponse(
        (res) => isSave(res)
      );
      await page.getByRole("button", { name: "save", exact: true }).click();
      expect((await saved).status()).toBe(200);

      await expect(titleSpan(page, `CatEdit Renamed ${marker}`)).toBeVisible();
      await expect(titleSpan(page, `CatEdit Orig ${marker}`)).toHaveCount(0);
      await expect(heading(page, "add_category")).toBeVisible();
      await expect(titleInput(page)).toHaveValue("");

      // Only the admin's own locale (ru) is edited: en text, collection, tags and colour survive.
      const after = await readCategory(category.id);
      expect(after.title.ru).toBe(`CatEdit Renamed ${marker}`);
      expect(after.title.en).toBe(`CatEdit English ${marker}`);
      expect(after.description.ru).toBe(`Desc Renamed ${marker}`);
      expect(after.description.en).toBe(`Desc English ${marker}`);
      expect(after.collectionId).toBe(category.collectionId);
      expect(after.tagsIds).toEqual([tag.id]);
      expect(after.color?.id).toBe(category.color?.id);
    } finally {
      await category.cleanup();
      await tag.cleanup();
    }
  });

  test("cancel leaves edit mode without saving anything", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const category = await createCategory(admin, {
      overrides: { title: { ru: `CatCancel ${marker}`, en: `CatCancel EN ${marker}` } },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      await rowFor(page, `CatCancel ${marker}`).getByTitle("edit_category").click();
      await titleInput(page).fill("should not be saved");

      await page.getByRole("button", { name: "cancel_action" }).click();
      await expect(heading(page, "add_category")).toBeVisible();
      await expect(titleInput(page)).toHaveValue("");
      await expect(titleSpan(page, `CatCancel ${marker}`)).toBeVisible();
      expect((await readCategory(category.id)).title.ru).toBe(`CatCancel ${marker}`);
    } finally {
      await category.cleanup();
    }
  });

  test("the parent list never offers the category itself, and a chosen parent is saved", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const parent = await createCategory(admin, {
      overrides: { title: { ru: `CatParent ${marker}`, en: `CatParent EN ${marker}` } },
    });
    const child = await createCategory(admin, {
      collectionId: parent.collectionId,
      colorId: parent.color?.id,
      overrides: { title: { ru: `CatChild ${marker}`, en: `CatChild EN ${marker}` } },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      await rowFor(page, `CatChild ${marker}`).getByTitle("edit_category").click();
      await expect(heading(page, "edit_category")).toBeVisible();

      // The parent list offers the other category but never the one being edited.
      await parentField(page).click();
      const panel = page.locator("[data-radix-popper-content-wrapper]");
      await panel.first().waitFor();
      // A short list has no search box (and is rendered whole); a long one is virtualized, so narrow it.
      const searchBox = panel.locator("input").first();
      if (await searchBox.isVisible().catch(() => false)) await searchBox.fill(`Cat`);
      await expect(panel.getByRole("button", { name: `CatParent ${marker}`, exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: `CatChild ${marker}`, exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");

      await pickComboboxOption(page, "parent_category", `CatParent ${marker}`);
      const saved = page.waitForResponse(
        (res) => isSave(res)
      );
      await page.getByRole("button", { name: "save", exact: true }).click();
      expect((await saved).status()).toBe(200);

      expect((await readCategory(child.id)).parentId).toBe(parent.id);
      // The row now carries the "subcategory of <parent>" badge.
      await expect(rowFor(page, `CatChild ${marker}`).getByText(`CatParent ${marker}`)).toBeVisible();
    } finally {
      await child.cleanup();
      await parent.cleanup();
    }
  });

  test("picking another palette colour in edit mode saves that colour", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const category = await createCategory(admin, {
      overrides: { title: { ru: `CatColor ${marker}`, en: `CatColor EN ${marker}` } },
    });
    const otherHex = "#" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const other = await createColor(admin, otherHex);

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      await rowFor(page, `CatColor ${marker}`).getByTitle("edit_category").click();
      await expect(heading(page, "edit_category")).toBeVisible();

      // Palette swatches are buttons titled with their hex.
      await page.locator(`button[title="${other.color}"]`).first().click();
      const saved = page.waitForResponse(
        (res) => isSave(res)
      );
      await page.getByRole("button", { name: "save", exact: true }).click();
      expect((await saved).status()).toBe(200);

      expect((await readCategory(category.id)).color?.id).toBe(other.id);
    } finally {
      await category.cleanup();
      await other.cleanup();
    }
  });

  test("deleting the category being edited drops the panel back to add mode", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const category = await createCategory(admin, {
      overrides: { title: { ru: `CatDelete ${marker}`, en: `CatDelete EN ${marker}` } },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/categories");

      const row = rowFor(page, `CatDelete ${marker}`);
      await row.getByTitle("edit_category").click();
      await expect(heading(page, "edit_category")).toBeVisible();

      await row.getByTitle("delete").click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(titleSpan(page, `CatDelete ${marker}`)).toHaveCount(0);
      await expect(heading(page, "add_category")).toBeVisible();
      await expect(titleInput(page)).toHaveValue("");
    } finally {
      await category.cleanup();
    }
  });
});

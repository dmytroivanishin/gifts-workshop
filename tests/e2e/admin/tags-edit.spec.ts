import { test, expect, APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createTag } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-tags-edit";

// CP-57: editing a tag now happens in the left form panel (the same pattern as collections),
// not inline inside the list row. The test DB's system_texts is empty, so every t() label renders
// as its raw key — "rename_tag" / "add_new_tag" below are the panel headings, "save" the button.
test.describe("admin tags: edit through the left form panel", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  async function readTagName(id: string): Promise<Record<string, string>> {
    const res = await admin.get(`/api/v1/tags/${id}`);
    return (await res.json()).data.name;
  }

  test("edit loads the tag into the panel, saving updates only this locale and returns to add mode", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const tag = await createTag(admin, { name: { ru: `TagEdit Orig ${marker}`, en: `TagEdit English ${marker}` } });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/tags");

      const row = page.locator("div.p-4.h-full", { hasText: `#TagEdit Orig ${marker}` });
      await expect(row).toBeVisible();
      await expect(page.getByRole("heading", { name: "add_new_tag" })).toBeVisible();

      await row.getByTitle("rename_tag").click();
      await expect(page.getByRole("heading", { name: "rename_tag" })).toBeVisible();
      const input = page.getByPlaceholder("placeholder_vintage");
      await expect(input).toHaveValue(`TagEdit Orig ${marker}`);

      await input.fill(`TagEdit Renamed ${marker}`);
      const saved = page.waitForResponse((res) => res.url().includes(`/api/v1/tags/${tag.id}`) && res.request().method() === "PUT");
      await page.getByRole("button", { name: "save", exact: true }).click();
      expect((await saved).status()).toBe(200);

      await expect(page.locator("div.p-4.h-full", { hasText: `#TagEdit Renamed ${marker}` })).toBeVisible();
      await expect(page.getByText(`#TagEdit Orig ${marker}`)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "add_new_tag" })).toBeVisible();
      await expect(input).toHaveValue("");

      // The other locale must survive: the panel only edits the admin's own locale (ru).
      const name = await readTagName(tag.id);
      expect(name.ru).toBe(`TagEdit Renamed ${marker}`);
      expect(name.en).toBe(`TagEdit English ${marker}`);
    } finally {
      await tag.cleanup();
    }
  });

  test("cancel leaves edit mode without saving anything", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const tag = await createTag(admin, { name: { ru: `TagCancel ${marker}` } });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/tags");

      const row = page.locator("div.p-4.h-full", { hasText: `#TagCancel ${marker}` });
      await row.getByTitle("rename_tag").click();
      const input = page.getByPlaceholder("placeholder_vintage");
      await input.fill("should not be saved");

      await page.getByRole("button", { name: "cancel_action" }).click();
      await expect(page.getByRole("heading", { name: "add_new_tag" })).toBeVisible();
      await expect(input).toHaveValue("");
      await expect(row).toBeVisible();
      expect((await readTagName(tag.id)).ru).toBe(`TagCancel ${marker}`);
    } finally {
      await tag.cleanup();
    }
  });

  test("deleting the tag being edited drops the panel back to add mode", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const tag = await createTag(admin, { name: { ru: `TagDelete ${marker}` } });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/tags");

      const row = page.locator("div.p-4.h-full", { hasText: `#TagDelete ${marker}` });
      await row.getByTitle("rename_tag").click();
      await expect(page.getByRole("heading", { name: "rename_tag" })).toBeVisible();

      await row.getByTitle("delete_tag").click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(page.getByText(`#TagDelete ${marker}`)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "add_new_tag" })).toBeVisible();
    } finally {
      await tag.cleanup();
    }
  });
});

import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { createColor } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-colors-edit";

// CP-57: editing a color happens in the left form panel (like collections), not inline in the
// list row. The test DB's system_texts is empty, so t() renders raw keys: the panel heading is
// "edit_color" / "add_color", the submit button "save", the row buttons are titled by key.
test.describe("admin colors: edit through the left form panel", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  async function readColor(id: string): Promise<string | undefined> {
    const res = await admin.get("/api/v1/colors");
    const colors: { id: string; color: string }[] = (await res.json()).data;
    return colors.find((c) => c.id === id)?.color;
  }

  const rowFor = (page: import("@playwright/test").Page, hex: string) =>
    page.locator("div.p-4.h-full", { hasText: hex.toUpperCase() });

  test("edit loads the color into the panel, saving updates it and returns to add mode", async ({ page }) => {
    const color = await createColor(admin, "#12AB34");

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/colors");

      await expect(rowFor(page, "#12AB34")).toBeVisible();
      await expect(page.getByRole("heading", { name: "add_color" })).toBeVisible();

      await rowFor(page, "#12AB34").getByTitle("edit_color").click();
      await expect(page.getByRole("heading", { name: "edit_color" })).toBeVisible();
      const hexInput = page.getByPlaceholder("#HEX");
      await expect(hexInput).toHaveValue(/#12ab34/i);

      await hexInput.fill("#34AB12");
      const saved = page.waitForResponse((res) => res.url().includes(`/api/v1/colors/${color.id}`) && res.request().method() === "PUT");
      await page.getByRole("button", { name: "save", exact: true }).click();
      expect((await saved).status()).toBe(200);

      await expect(rowFor(page, "#34AB12")).toBeVisible();
      await expect(rowFor(page, "#12AB34")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "add_color" })).toBeVisible();

      expect((await readColor(color.id))?.toLowerCase()).toBe("#34ab12");
    } finally {
      await color.cleanup();
    }
  });

  test("cancel leaves edit mode without saving anything", async ({ page }) => {
    const color = await createColor(admin, "#56CD78");

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/colors");

      await rowFor(page, "#56CD78").getByTitle("edit_color").click();
      await page.getByPlaceholder("#HEX").fill("#000000");

      await page.getByRole("button", { name: "cancel_action" }).click();
      await expect(page.getByRole("heading", { name: "add_color" })).toBeVisible();
      await expect(rowFor(page, "#56CD78")).toBeVisible();
      expect((await readColor(color.id))?.toLowerCase()).toBe("#56cd78");
    } finally {
      await color.cleanup();
    }
  });

  test("deleting the color being edited drops the panel back to add mode", async ({ page }) => {
    const color = await createColor(admin, "#78EF90");

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/colors");

      const row = rowFor(page, "#78EF90");
      await row.getByTitle("edit_color").click();
      await expect(page.getByRole("heading", { name: "edit_color" })).toBeVisible();

      await row.getByTitle("delete").click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(rowFor(page, "#78EF90")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "add_color" })).toBeVisible();
    } finally {
      await color.cleanup();
    }
  });
});

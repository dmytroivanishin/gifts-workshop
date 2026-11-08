import { test, expect, APIRequestContext, Page } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createCollection } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-collections-edit";

// CP-57: collections were the model for editing in the left form panel; this pins that behaviour
// the same way tags/colors/categories are pinned. The test DB's system_texts is empty, so t()
// renders raw keys ("edit_collection" / "add_collection" headings, "save" button).
test.describe("admin collections: edit through the left form panel", () => {
  let admin: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  interface CollectionDto {
    title: Record<string, string>;
    description: Record<string, string>;
    main: boolean;
  }

  async function readCollection(id: string): Promise<CollectionDto> {
    const res = await admin.get(`/api/v1/collections/${id}`);
    return (await res.json()).data;
  }

  const rowFor = (page: Page, title: string) => page.locator("div.p-4.h-full", { hasText: title });
  const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true });
  const titleInput = (page: Page) => page.getByPlaceholder("placeholder_collection_title");
  const descInput = (page: Page) => page.getByPlaceholder("placeholder_collection_desc");

  test("edit loads the collection into the panel, saving updates this locale only and the main flag", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const collection = await createCollection(admin, {
      title: { ru: `ColEdit Orig ${marker}`, en: `ColEdit English ${marker}` },
      description: { ru: `ColDesc Orig ${marker}`, en: `ColDesc English ${marker}` },
      main: false,
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/collections");

      await expect(rowFor(page, `ColEdit Orig ${marker}`)).toBeVisible();
      await expect(heading(page, "add_collection")).toBeVisible();

      await rowFor(page, `ColEdit Orig ${marker}`).getByTitle("edit_collection").click();
      await expect(heading(page, "edit_collection")).toBeVisible();
      await expect(titleInput(page)).toHaveValue(`ColEdit Orig ${marker}`);
      await expect(descInput(page)).toHaveValue(`ColDesc Orig ${marker}`);
      await expect(page.locator("#mainCollectionCheckbox")).not.toBeChecked();

      await titleInput(page).fill(`ColEdit Renamed ${marker}`);
      await descInput(page).fill(`ColDesc Renamed ${marker}`);
      await page.locator("#mainCollectionCheckbox").check();
      const saved = page.waitForResponse(
        (res) => res.url().includes(`/api/v1/collections/${collection.id}`) && res.request().method() === "PUT"
      );
      await page.getByRole("button", { name: "save", exact: true }).click();
      expect((await saved).status()).toBe(200);

      await expect(rowFor(page, `ColEdit Renamed ${marker}`)).toBeVisible();
      await expect(rowFor(page, `ColEdit Orig ${marker}`)).toHaveCount(0);
      await expect(heading(page, "add_collection")).toBeVisible();
      await expect(titleInput(page)).toHaveValue("");
      await expect(page.locator("#mainCollectionCheckbox")).not.toBeChecked();

      const after = await readCollection(collection.id);
      expect(after.title.ru).toBe(`ColEdit Renamed ${marker}`);
      expect(after.title.en).toBe(`ColEdit English ${marker}`);
      expect(after.description.ru).toBe(`ColDesc Renamed ${marker}`);
      expect(after.description.en).toBe(`ColDesc English ${marker}`);
      expect(after.main).toBe(true);
    } finally {
      await collection.cleanup();
    }
  });

  test("cancel leaves edit mode without saving anything", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const collection = await createCollection(admin, {
      title: { ru: `ColCancel ${marker}`, en: `ColCancel EN ${marker}` },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/collections");

      await rowFor(page, `ColCancel ${marker}`).getByTitle("edit_collection").click();
      await titleInput(page).fill("should not be saved");

      await page.getByRole("button", { name: "cancel_action" }).click();
      await expect(heading(page, "add_collection")).toBeVisible();
      await expect(titleInput(page)).toHaveValue("");
      await expect(rowFor(page, `ColCancel ${marker}`)).toBeVisible();
      expect((await readCollection(collection.id)).title.ru).toBe(`ColCancel ${marker}`);
    } finally {
      await collection.cleanup();
    }
  });

  test("deleting the collection being edited drops the panel back to add mode", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 8);
    const collection = await createCollection(admin, {
      title: { ru: `ColDelete ${marker}`, en: `ColDelete EN ${marker}` },
    });

    try {
      await loginAsAdmin(page);
      await page.goto("/admin/collections");

      const row = rowFor(page, `ColDelete ${marker}`);
      await row.getByTitle("edit_collection").click();
      await expect(heading(page, "edit_collection")).toBeVisible();

      await row.getByTitle("delete_collection").click();
      await page.getByTestId("confirm-modal-confirm").click();

      await expect(rowFor(page, `ColDelete ${marker}`)).toHaveCount(0);
      await expect(heading(page, "add_collection")).toBeVisible();
      await expect(titleInput(page)).toHaveValue("");
    } finally {
      await collection.cleanup();
    }
  });
});

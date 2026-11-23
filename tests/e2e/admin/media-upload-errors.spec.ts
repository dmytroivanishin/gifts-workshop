import { test, expect, Page } from "@playwright/test";
import { tinyPng } from "../../api/helpers/images";
import { loginAsAdmin } from "../helpers/auth";
import { adminContext } from "../../api/helpers/auth";

// Upload failures reach the admin as one toast per file that names the file and says whether the
// connection or the server failed, and closing the tab mid-batch asks for confirmation. The request is
// intercepted, so the failure is forced rather than hoped for.

const uploadRequest = (page: Page) =>
  page.route("**/api/v1/media", async (route) => {
    if (route.request().method() === "POST") {
      await uploadHandler(route);
    } else {
      await route.continue();
    }
  });

let uploadHandler: (route: import("@playwright/test").Route) => Promise<void>;

test.describe("admin media: upload failure messages and leaving during a batch", () => {
  // Some tests let an upload reach the server (a held request released later, or a reload that does not
  // stop it). Every row that got saved is removed afterwards, so later specs see the same library.
  let admin: import("@playwright/test").APIRequestContext;
  let savedIds: Promise<string>[] = [];

  test.beforeAll(async () => {
    admin = await adminContext("e2e-media-upload-errors");
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test.beforeEach(async ({ page }) => {
    savedIds = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/v1/media") && res.request().method() === "POST" && res.ok()) {
        savedIds.push(res.json().then((body) => body.data.id as string));
      }
    });
    await loginAsAdmin(page);
    await page.goto("/admin/media");
  });

  test.afterEach(async () => {
    const ids = (await Promise.allSettled(savedIds))
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);
    for (const id of ids) {
      await admin.delete(`/api/v1/media/${id}`);
    }
  });

  test("a dropped connection names the file and says the connection was lost", async ({ page }) => {
    uploadHandler = (route) => route.abort("connectionfailed");
    await uploadRequest(page);

    const name = `e2e-conn-lost-${Date.now()}.png`;
    await page.locator('input[type="file"]').setInputFiles([
      { name, mimeType: "image/png", buffer: await tinyPng() },
    ]);

    const toast = page.locator("[data-sonner-toast]", { hasText: name });
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText(/upload_connection_lost|Соединение прервано/);
    await expect(toast).not.toContainText(/upload_server_error|Ошибка сервера/);
    // The inline panel still lists the file, as before.
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("a server error names the file and says the server failed", async ({ page }) => {
    uploadHandler = (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ data: {}, error: { code: "UNKNOWN_SERVER_ERROR", message: "boom" } }),
      });
    await uploadRequest(page);

    const name = `e2e-server-error-${Date.now()}.png`;
    await page.locator('input[type="file"]').setInputFiles([
      { name, mimeType: "image/png", buffer: await tinyPng() },
    ]);

    const toast = page.locator("[data-sonner-toast]", { hasText: name });
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText(/upload_server_error|Ошибка сервера/);
    await expect(toast).not.toContainText(/upload_connection_lost|Соединение прервано/);
  });

  test("a menu link during a batch asks with the app's own dialog; leaving stops the remaining files", async ({ page }) => {
    let uploadsSent = 0;
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => (releaseFirst = resolve));
    let firstStarted!: () => void;
    const started = new Promise<void>((resolve) => (firstStarted = resolve));
    uploadHandler = async (route) => {
      uploadsSent++;
      if (uploadsSent === 1) {
        firstStarted();
        await firstReleased;
      }
      await route.continue().catch(() => undefined);
    };
    await uploadRequest(page);

    await page.locator('input[type="file"]').setInputFiles([
      { name: `e2e-menu-a-${Date.now()}.png`, mimeType: "image/png", buffer: await tinyPng() },
      { name: `e2e-menu-b-${Date.now()}.png`, mimeType: "image/png", buffer: await tinyPng() },
    ]);
    await started;

    const menuLink = page.locator('a[href="/admin/posts"]').first();
    await menuLink.click();
    // Our dialog, not the browser's: the confirm button carries our test id and the page has not moved.
    await expect(page.getByTestId("confirm-modal-confirm")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/media$/);

    // Stay: the dialog closes and the batch carries on.
    await page.getByTestId("confirm-modal-cancel").click();
    await expect(page.getByTestId("confirm-modal-confirm")).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/media$/);

    // Leave: the page changes and the second file is never sent.
    await menuLink.click();
    await page.getByTestId("confirm-modal-confirm").click();
    await expect(page).toHaveURL(/\/admin\/posts$/);
    releaseFirst();
    await page.waitForTimeout(1500);
    expect(uploadsSent).toBe(1);
  });

  test("reloading the tab while a batch is uploading asks the browser to confirm", async ({ page }) => {
    let uploadStarted!: () => void;
    const started = new Promise<void>((resolve) => (uploadStarted = resolve));
    uploadHandler = async (route) => {
      uploadStarted();
      // Hold the request open so the batch is still running when the tab is reloaded.
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await route.continue();
    };
    await uploadRequest(page);

    let dialogType: string | undefined;
    page.on("dialog", (dialog) => {
      dialogType = dialog.type();
      void dialog.dismiss();
    });

    await page.locator('input[type="file"]').setInputFiles([
      { name: `e2e-leave-${Date.now()}.png`, mimeType: "image/png", buffer: await tinyPng() },
    ]);
    await started;

    // Dismissing the prompt cancels the reload, so the navigation promise never settles: do not await it.
    void page.reload().catch(() => undefined);
    await expect.poll(() => dialogType, { timeout: 10_000 }).toBe("beforeunload");
  });
});

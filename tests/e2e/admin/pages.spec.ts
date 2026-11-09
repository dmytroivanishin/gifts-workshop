import { test, expect, APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-pages";

// The test DB's system_texts is empty, so every label renders as its raw key (see helpers/auth.ts).
test.describe("pages: admin form, auto slug, public header/footer/page", () => {
  let admin: APIRequestContext;
  const created: string[] = [];

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
  });

  test.afterAll(async () => {
    for (const id of created) await admin.delete(`/api/v1/pages/${id}`);
    await admin.dispose();
  });

  test("create a page in the UI: slug follows the title, a manual slug is kept, the public site shows it with its spacing", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 6);
    const title = `Hello World ${marker}`;
    const text = "First line\n\n    indented   line";

    await loginAsAdmin(page);
    await page.goto("/admin/pages");

    const slugField = page.getByPlaceholder("about");
    let slugRequests = 0;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/v1/slugs")) slugRequests++;
    });

    // Typed quickly: the slug is suggested once, after the pause, not per keystroke.
    await page.getByPlaceholder("placeholder_page_title").pressSequentially(title, { delay: 40 });
    await expect(slugField).toHaveValue(`hello-world-${marker}`, { timeout: 10000 });
    expect(slugRequests).toBe(1);

    // A manual address is not overwritten by later title edits.
    await slugField.fill(`custom-${marker}`);
    await page.getByPlaceholder("placeholder_page_title").fill(`${title} changed`);
    await page.waitForTimeout(1500);
    await expect(slugField).toHaveValue(`custom-${marker}`);

    await page.getByPlaceholder("placeholder_page_description").fill(text);
    const response = page.waitForResponse((r) => /\/api\/v1\/pages$/.test(r.url()) && r.request().method() === "POST");
    await page.getByRole("button", { name: "add_page" }).last().click();
    const body = await (await response).json();
    created.push(body.data.id);
    expect(body.data.slug).toBe(`custom-${marker}`);
    expect(body.data.description.ru).toBe(text);

    // Public side: the page keeps its spacing, and the header and footer link to it.
    await page.goto(`/ru/pages/custom-${marker}`);
    await expect(page.getByRole("heading", { name: `${title} changed` })).toBeVisible();
    const articleText = page.locator("article > div");
    expect(await articleText.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("pre-wrap");
    expect(await articleText.innerText()).toBe(text);
    await expect(page.locator("header").getByRole("link", { name: `${title} changed` })).toBeVisible();
    await expect(page.locator("footer").getByRole("link", { name: `${title} changed` })).toBeVisible();
    await expect(page.locator("footer").getByRole("link", { name: "site_map" })).toBeVisible();

    // There is a way back to the homepage from an info page and from the site map.
    await page.getByRole("link", { name: "back_to_home" }).click();
    await expect(page).toHaveURL(/\/ru$/);
    await page.goto("/ru/sitemap");
    await page.getByRole("link", { name: "back_to_home" }).click();
    await expect(page).toHaveURL(/\/ru$/);
  });

  test("a page hidden from the menu has no header/footer link but is still reachable, and an unknown page is a 404", async ({ page }) => {
    const marker = crypto.randomUUID().slice(0, 6);
    const res = await admin.post("/api/v1/pages", { data: { title: { ru: `Hidden ${marker}` }, showInMenu: false } });
    const created_ = (await res.json()).data;
    created.push(created_.id);

    await page.goto("/ru/sitemap");
    await expect(page.locator("header").getByRole("link", { name: `Hidden ${marker}` })).toHaveCount(0);
    await expect(page.locator("footer").getByRole("link", { name: `Hidden ${marker}` })).toHaveCount(0);

    const direct = await page.goto(`/ru/pages/${created_.slug}`);
    expect(direct?.status()).toBe(200);

    const missing = await page.goto(`/ru/pages/nope-${marker}`);
    expect(missing?.status()).toBe(404);
  });

  test("on a phone the header sits above the logo instead of overlapping it", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await context.newPage();
    await page.goto("/ru");
    const header = await page.locator("header").boundingBox();
    const logo = await page.locator("main img").first().boundingBox();
    if (!header || !logo) throw new Error("header or logo not found");
    expect(logo.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    await context.close();
  });
});

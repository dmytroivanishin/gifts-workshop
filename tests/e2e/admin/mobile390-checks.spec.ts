import { test, expect, APIRequestContext } from "@playwright/test";
import crypto from "crypto";
import { adminContext } from "../../api/helpers/auth";
import { createCollection, createCategory, createMedia } from "../../api/helpers/fixtures";
import { loginAsAdmin } from "../helpers/auth";

// Mobile checks at 390 px (the owner's reference width): the public price line, the admin price field,
// the save loader and the cover crop clamp. The viewport is set for the whole file, so these are real
// 390 px layouts (not a desktop window squeezed by hand).
test.use({ viewport: { width: 390, height: 767 } });

const FILE_KEY = "e2e-mobile390-checks";

test.describe("390 px: price, save loader, crop", () => {
  let admin: APIRequestContext;
  let slug = "";
  let postId = "";
  const cleanups: Array<() => Promise<void>> = [];

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    const marker = crypto.randomUUID().slice(0, 8);
    const collection = await createCollection(admin);
    const category = await createCategory(admin, { collectionId: collection.id });
    const media = await createMedia(admin);
    cleanups.push(() => category.cleanup(), () => collection.cleanup(), () => media.cleanup());

    // The post with a price and a gallery item, so the crop button exists on the editor page.
    const res = await admin.post("/api/v1/posts", {
      data: {
        status: "Published",
        title: { ru: `Работа 390 ${marker}`, en: `Work 390 ${marker}` },
        description: { ru: `Описание для проверки на 390 ${marker}`, en: `Description 390 ${marker}` },
        collectionId: collection.id,
        categoryId: category.id,
        posterId: media.id,
        price: 1500,
        inStock: true,
        tagsIds: [],
        media: [{ mediaId: media.id, order: 0, position: { x: 0, y: 0, zoom: 1 } }],
      },
    });
    const body = await res.json();
    expect(res.status(), JSON.stringify(body)).toBe(200);
    postId = body.data.id;
    slug = body.data.slug;
    cleanups.unshift(async () => {
      await admin.delete(`/api/v1/posts/${postId}`);
    });
  });

  test.afterAll(async () => {
    for (const cleanup of cleanups) await cleanup();
    await admin.dispose();
  });

  test("public card: price is 22px serif, reads «N р.», inside the 390 viewport", async ({ page }) => {
    await page.goto("/ru");
    const price = page.locator('[data-test-id="post-price"]').first();
    await expect(price).toBeVisible();
    await expect(price).toHaveText(/1\s500 р\./);
    const box = await price.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await expect(price).toHaveCSS("font-size", "22px");
    expect(await price.evaluate((el) => getComputedStyle(el).fontFamily.includes("serif"))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("public post page: «Цена: N р.» under the description, 18px, no horizontal scroll", async ({ page }) => {
    await page.goto(`/ru/posts/${slug}`);
    const price = page.locator('[data-test-id="post-price"]');
    // The label is the translation key in an empty test DB and the Russian word in a seeded one.
    await expect(price).toHaveText(/^(Цена|price): 1\s500 р\.$/);
    await expect(price).toHaveCSS("font-size", "18px");
    const priceY = (await price.boundingBox())!.y;
    const descY = (await page.getByText(`Описание для проверки на 390`).boundingBox())!.y;
    expect(priceY).toBeGreaterThan(descY);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("admin editor: price field sits in the stock row, saves empty as NULL and a number back", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/posts/${postId}`);
    const price = page.locator("form input[type='number']");
    await expect(price).toHaveValue("1500");
    const stock = page.locator("form input[type='checkbox'], form [role='checkbox']").first();
    const priceBox = (await price.boundingBox())!;
    const stockBox = (await stock.boundingBox())!;
    await page.screenshot({ path: "/tmp/claude-1000/-home-dmytro-projects-portfolio/fe107670-6895-4dd6-876e-cff3d688ae52/scratchpad/price-row-390.png", fullPage: false });
    // The label sits above the field (uppercase, like the other field labels), and the field stays in the stock row.
    const label = page.locator("form label", { hasText: /^(Цена|price)$/ }).first();
    const labelBox = (await label.boundingBox())!;
    expect(labelBox.y).toBeLessThan(priceBox.y);
    expect(await label.evaluate((el) => getComputedStyle(el).textTransform)).toBe("uppercase");
    // Level with the checkbox: the centres of the input and the checkbox sit on one line (a few px of tolerance).
    expect(Math.abs(priceBox.y + priceBox.height / 2 - (stockBox.y + stockBox.height / 2))).toBeLessThan(4);
    // The two headers ("НАЛИЧИЕ" and "ЦЕНА") start on one line, and so do the checkbox and the input.
    const stockLabel = page.locator("form label", { hasText: /^(Наличие|availability)$/ }).first();
    const stockLabelBox = (await stockLabel.boundingBox())!;
    expect(Math.abs(stockLabelBox.y - labelBox.y)).toBeLessThan(3);
    expect(Math.abs(stockBox.y - priceBox.y)).toBeLessThan(40);
    expect(priceBox.x + priceBox.width).toBeLessThanOrEqual(390);

    await price.fill("");
    const saved = page.waitForResponse((res) => res.url().includes(`/api/v1/posts/${postId}`) && res.request().method() === "PUT");
    await page.getByRole("button", { name: "Обновить" }).click();
    expect((await saved).status()).toBe(200);
    const after = await (await admin.get(`/api/v1/posts/${postId}`)).json();
    expect(after.data.price).toBeNull();

    await page.goto(`/admin/posts/${postId}`);
    await expect(page.locator("form input[type='number']")).toHaveValue("");
    await page.locator("form input[type='number']").fill("1500");
    const savedAgain = page.waitForResponse((res) => res.url().includes(`/api/v1/posts/${postId}`) && res.request().method() === "PUT");
    await page.getByRole("button", { name: "Обновить" }).click();
    expect((await savedAgain).status()).toBe(200);
  });

  // The stock, price and publication-date fields form one row at every width: their headers start on one line,
  // their controls start on one line, and on a phone the price sits at the right edge.
  for (const width of [390, 800, 1024, 1440]) {
    test(`admin editor at ${width} px: stock, price and date fields line up`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAsAdmin(page);
      await page.goto(`/admin/posts/${postId}`);
      const price = page.locator("form input[type='number']");
      await expect(price).toHaveValue("1500");
      const stockLabel = page.locator("form label", { hasText: /^(Наличие|availability)$/ }).first();
      const priceLabel = page.locator("form label", { hasText: /^(Цена|price)$/ }).first();
      const dateLabel = page.locator("form label", { hasText: /^(Дата публикации|creation_date)$/ }).first();
      const checkbox = page.locator("#inStockCheckbox");
      const dateButton = page.locator("form button", { hasText: /\d{4}|select_date|Выберите дату/ }).first();
      const box = async (locator: ReturnType<typeof page.locator>) => (await locator.boundingBox())!;

      const [stockH, priceH, dateH] = await Promise.all([box(stockLabel), box(priceLabel), box(dateLabel)]);
      const [checkBox, priceBox, dateBox] = await Promise.all([box(checkbox), box(price), box(dateButton)]);
      expect(Math.abs(stockH.y - priceH.y)).toBeLessThan(3);
      expect(Math.abs(checkBox.y + checkBox.height / 2 - (priceBox.y + priceBox.height / 2))).toBeLessThan(4);
      // From the two-column breakpoint (640 px) the date shares the row; below it the date is stacked under the row.
      if (width >= 640) {
        expect(Math.abs(priceH.y - dateH.y)).toBeLessThan(3);
        expect(Math.abs(priceBox.y - dateBox.y)).toBeLessThan(3);
        expect(Math.abs(priceBox.height - dateBox.height)).toBeLessThan(2);
      }
      if (width === 390) {
        const rowRight = await price.evaluate((el) => el.parentElement!.parentElement!.getBoundingClientRect().right);
        expect(Math.abs(priceBox.x + priceBox.width - rowRight)).toBeLessThan(2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test("save button shows a spinner while the request is in flight", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/posts/${postId}`);
    await expect(page.locator("form input[type='number']")).toHaveValue("1500");
    // Hold the update for a moment so the loader can be seen.
    await page.route(`**/api/v1/posts/${postId}`, async (route) => {
      if (route.request().method() === "PUT") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });
    const button = page.getByRole("button", { name: "Обновить" });
    await button.click();
    await expect(button.locator("svg.animate-spin")).toBeVisible();
  });

  test("cover crop: dragging the photo past its edge is clamped, the page does not scroll", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/posts/${postId}`);
    await page.locator('button[title="Положение"], button[title="position"]').first().click();
    const crop = page.locator("div.touch-none").first();
    await expect(crop).toBeVisible();
    const readout = page.getByText(/X: -?\d+px/);
    await expect(readout).toHaveText("X: 0px, Y: 0px");
    const box = (await crop.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let step = 1; step <= 20; step++) {
      await page.mouse.move(cx - step * 25, cy);
    }
    await page.mouse.up();
    const moved = await readout.textContent();
    const x = Number(moved?.match(/X: (-?\d+)px/)?.[1]);
    // The drag must really move the photo (otherwise a clamp check would pass for nothing), and stop at the edge.
    // The allowed offset is half of how much wider the photo is than the crop box, measured on the page.
    const shown = (await crop.locator("img").first().boundingBox())!;
    const maxOffset = (shown.width - box.width) / 2;
    expect(x).toBeLessThan(0);
    expect(Math.abs(x)).toBeLessThanOrEqual(maxOffset + 2);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });
});

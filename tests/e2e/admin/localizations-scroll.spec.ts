import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext } from "../../api/helpers/auth";
import { loginAsAdmin } from "../helpers/auth";

const FILE_KEY = "e2e-localizations-scroll";
// The editor shows 12 per page, so 14 texts means the second page only arrives by scrolling.
const TEXT_COUNT = 14;

test.describe("admin localizations: infinite scroll", () => {
  let admin: APIRequestContext;
  const createdIds: string[] = [];
  const stamp = Date.now();

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    for (let index = 0; index < TEXT_COUNT; index++) {
      const res = await admin.post("/api/v1/system-texts", {
        data: {
          code: `e2e_scroll_${stamp}_${index}`,
          content: { ru: `Текст ${index}`, en: `Text ${index}` },
          area: "admin",
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      createdIds.push(body.data.id);
    }
  });

  test.afterAll(async () => {
    for (const id of createdIds) {
      await admin.delete(`/api/v1/system-texts/${id}`);
    }
    await admin.dispose();
  });

  test("the next page loads when the list is scrolled to the end, with no load-more button", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/localizations");
    await page.getByRole("button", { name: /Системные тексты|system_texts/ }).click();

    const cards = page.locator("div.grid h3");
    await expect(cards.first()).toBeVisible();
    const firstPageCount = await cards.count();
    expect(firstPageCount).toBeLessThanOrEqual(12);

    await expect(page.getByRole("button", { name: /Загрузить еще/ })).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect.poll(() => cards.count()).toBeGreaterThan(firstPageCount);
  });
});

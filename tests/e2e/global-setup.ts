import { adminContext } from "../api/helpers/auth";

// Next's dev server compiles each route on its first request, and Playwright starts a fresh dev server
// for every run. Without this, the first page a test opens can take longer than the test itself, so
// whichever spec runs first fails. Requesting every admin and public page once, before any test,
// moves that compile out of the tests. Nothing here changes a timeout.
const WARM_UP_PAGES = [
  "/admin/dashboard",
  "/admin/posts",
  "/admin/posts/new",
  "/admin/categories",
  "/admin/collections",
  "/admin/tags",
  "/admin/colors",
  "/admin/pages",
  "/admin/media",
  "/admin/comments",
  "/admin/localizations",
  "/ru",
  "/en",
];

export default async function globalSetup(): Promise<void> {
  const admin = await adminContext("e2e-warm-up");
  try {
    for (const path of WARM_UP_PAGES) {
      const response = await admin.get(path);
      await response.body();
    }
  } finally {
    await admin.dispose();
  }
}

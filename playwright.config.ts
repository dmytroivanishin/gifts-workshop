import { defineConfig, devices } from "@playwright/test";

// API tests (tests/api/**) hit a real running server with real HTTP requests — no mocking of the
// DI container, Drizzle or Next's own request plumbing. They need the test Postgres + test MinIO
// from docker-compose.test.yml (scripts/run-test.sh test:db:start) and config/test.env's vars
// already exported into the process (scripts/run-test.sh sources them before `npm run test:api`).
//
// The "e2e" project (tests/e2e/**) drives a real Chromium browser against the same webServer —
// drag-and-drop, file inputs, localStorage, CSS/animation and other things the "api" project
// above cannot exercise over plain HTTP. CP-31 phase 3.
export default defineConfig({
  testDir: "./tests",
  // Not fullyParallel: several spec files share one admin/anon APIRequestContext across their own
  // tests (beforeAll) and rely on running in file order within that context (refresh-token
  // rotation in auth.spec.ts especially) — fullyParallel would let Playwright interleave tests
  // from the SAME file across workers too, racing that shared, mutable session state. Different
  // files already run in parallel across workers under the default (non-fullyParallel) mode,
  // which is the parallelism that actually matters here.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
    // getByTestId() reads this attribute instead of the Playwright default "data-testid" —
    // matches the data-test-id attributes on the e2e-only elements in src/ (ProjectCard,
    // SortableMediaGrid, SortableCategoryTree, ConfirmModal, the post editor's Publish button).
    testIdAttribute: "data-test-id",
  },
  projects: [
    {
      name: "api",
      testDir: "./tests/api",
      testMatch: /.*\.spec\.ts/,
    },
    {
      name: "e2e",
      testDir: "./tests/e2e",
      testMatch: /.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next dev -p 3001",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

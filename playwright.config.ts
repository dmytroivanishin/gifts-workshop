import { defineConfig } from "@playwright/test";

// API tests (tests/api/**) hit a real running server with real HTTP requests — no mocking of the
// DI container, Drizzle or Next's own request plumbing. They need the test Postgres + test MinIO
// from docker-compose.test.yml (scripts/run-test.sh test:db:start) and config/test.env's vars
// already exported into the process (scripts/run-test.sh sources them before `npm run test:api`).
//
// The "e2e" project is a placeholder only — `npm run test:e2e` already exists as a script and this
// keeps `--project=e2e` resolving to something instead of erroring, but no spec files or browser
// config exist for it yet. Designing e2e is a separate, later phase (CP-31).
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
    },
  ],
  webServer: {
    command: "npx next dev -p 3001",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

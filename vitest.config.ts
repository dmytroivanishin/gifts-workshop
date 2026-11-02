import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Unit tests (tests/unit/**) cover pure logic only — no DB, no browser, no Docker. They need
// JWT_SECRET/ADMIN_EMAILS/etc. in process.env *before* any file importing src/modules/core/env.ts
// is loaded (it validates all 32 required vars at import time), which is why this suite is run
// via `bash scripts/run-test.sh test:unit` (sources config/test.env first), not raw `vitest run`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.spec.ts"],
  },
});

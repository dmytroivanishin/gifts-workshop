import { test, expect } from "@playwright/test";
import { adminContext, anonContext } from "./helpers/auth";
import { expectError } from "./helpers/client";

const FILE_KEY = "api-rate-limit-reads";
const OTHER_KEY = "api-rate-limit-reads-other-visitor";

// RATE_LIMITS.publicRead: every GET under /api/v1 from a caller without a valid admin token. The test
// stack lifts the production default (120/min) through RATE_LIMIT_PUBLIC_READ_PER_MINUTE because the
// whole suite runs from a few addresses; the limit is read from the same variable here so the test
// follows whatever the server was started with.
const limit = Number(process.env.RATE_LIMIT_PUBLIC_READ_PER_MINUTE) || 120;

test.describe("public read rate limit", () => {
  test("the request after the limit gets 429 with Retry-After; an admin and another visitor are not affected", async () => {
    const visitor = await anonContext(FILE_KEY);
    const sameAddressAdmin = await adminContext(FILE_KEY);
    const otherVisitor = await anonContext(OTHER_KEY);

    try {
      const batch = 50;
      let sent = 0;
      while (sent < limit) {
        const size = Math.min(batch, limit - sent);
        const responses = await Promise.all(
          Array.from({ length: size }, () => visitor.get("/api/v1/colors"))
        );
        for (const response of responses) expect(response.status()).toBe(200);
        sent += size;
      }

      const blocked = await visitor.get("/api/v1/colors");
      await expectError(blocked, 429, "TOO_MANY_REQUESTS");
      expect(Number(blocked.headers()["retry-after"])).toBeGreaterThanOrEqual(1);

      // Same address, but with a valid admin token: the public limit does not apply to it.
      const adminRead = await sameAddressAdmin.get("/api/v1/media");
      expect(adminRead.status()).toBe(200);

      // A different address has its own counter.
      expect((await otherVisitor.get("/api/v1/colors")).status()).toBe(200);
    } finally {
      await visitor.dispose();
      await sameAddressAdmin.dispose();
      await otherVisitor.dispose();
    }
  });
});

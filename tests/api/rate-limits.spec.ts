import { test, expect, request as pwRequest } from "@playwright/test";
import { adminContext, anonContext, clientIpFor } from "./helpers/auth";
import { expectError } from "./helpers/client";
import { createPost } from "./helpers/fixtures";

// CP-64 step 5: the write-side limits (the public GET limit has its own file). Each test uses its own
// synthetic client address, so exhausting one bucket never touches another test or spec file.
const baseURL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const ipContext = (key: string) =>
  pwRequest.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`rate-limits-${key}`) } });

test.describe("write-side rate limits", () => {
  test("public comments: the 6th within the window is a 429 with Retry-After, another address is unaffected", async () => {
    const admin = await adminContext("rate-limits-admin");
    const post = await createPost(admin, { status: "Published" });
    const spammer = await ipContext("comments");
    const bystander = await ipContext("comments-other");
    const send = (ctx: typeof spammer) => ctx.post(`/api/v1/posts/${post.id}/comments`, { data: { name: "n", text: "t" } });

    for (let i = 0; i < 5; i += 1) expect((await send(spammer)).status()).toBe(200);
    const blocked = await send(spammer);
    await expectError(blocked, 429, "TOO_MANY_REQUESTS");
    expect(Number(blocked.headers()["retry-after"])).toBeGreaterThanOrEqual(1);

    expect((await send(bystander)).status()).toBe(200);

    await spammer.dispose();
    await bystander.dispose();
    await post.cleanup();
    await admin.dispose();
  });

  test("auth routes: the 21st call within a minute is a 429, even with a wrong body", async () => {
    const ctx = await ipContext("auth");
    let blockedAt = 0;
    for (let i = 1; i <= 25 && !blockedAt; i += 1) {
      const res = await ctx.post("/api/v1/auth/google/exchange", { data: { code: "x", state: "y" } });
      if (res.status() === 429) blockedAt = i;
    }
    expect(blockedAt).toBe(21);
    await ctx.dispose();
  });

  test("admin writes: loose limit, the 301st write in a minute is a 429 and reads still work", async () => {
    const admin = await adminContext("rate-limits-adminwrite");
    // Failing writes still count; a 404 delete is the cheapest write there is.
    const statuses: number[] = [];
    for (let batch = 0; batch < 7; batch += 1) {
      const responses = await Promise.all(
        Array.from({ length: 50 }, () => admin.delete("/api/v1/tags/00000000-0000-4000-8000-000000000000"))
      );
      statuses.push(...responses.map((response) => response.status()));
    }
    // Batches run in parallel, so only the totals are exact: the login above plus 350 writes cross
    // 300, and nothing is refused while well under it.
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(1);
    expect(statuses.filter((status) => status !== 429).length).toBeLessThanOrEqual(300);
    expect(statuses.slice(0, 250).every((status) => status !== 429)).toBe(true);

    // An admin's reads are never limited.
    expect((await admin.get("/api/v1/tags")).status()).toBe(200);
    await admin.dispose();
  });

  test("an anonymous visitor's rate-limit bucket is not shared with an admin on another address", async () => {
    const anon = await anonContext("rate-limits-isolation");
    expect((await anon.get("/api/v1/tags")).status()).toBe(200);
    await anon.dispose();
  });
});

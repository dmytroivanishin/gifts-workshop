import { test, expect, APIRequestContext } from "@playwright/test";
import { adminContext, anonContext, mintToken, contextWithAccessToken } from "./helpers/auth";
import { expectError } from "./helpers/client";
import { createPost } from "./helpers/fixtures";

// The gate itself (src/proxy.ts + withAdminAuth()), cross-entity. Each entity's own business
// rules (validation, conflicts, etc.) live in that entity's own spec file — this file only
// samples the auth matrix: anonymous, a foreign-email/wrong-role token, and a real admin.

const FILE_KEY = "proxy-auth-matrix";

test.describe("proxy auth matrix", () => {
  let admin: APIRequestContext;
  let anon: APIRequestContext;
  let foreignCtx: APIRequestContext;

  test.beforeAll(async () => {
    admin = await adminContext(FILE_KEY);
    anon = await anonContext(FILE_KEY);
    const foreignToken = await mintToken({ email: "not-an-admin@example.com" });
    foreignCtx = await contextWithAccessToken(FILE_KEY + "-foreign", foreignToken);
  });

  test.afterAll(async () => {
    await admin.dispose();
    await anon.dispose();
    await foreignCtx.dispose();
  });

  test("every GET under /users/**, /admin/**, /media/** needs a valid admin token", async () => {
    const paths = ["/api/v1/users", "/api/v1/admin/comments", "/api/v1/media"];
    for (const path of paths) {
      await expectError(await anon.get(path), 401);
      await expectError(await foreignCtx.get(path), 401);
      expect((await admin.get(path)).ok(), `admin GET ${path} should pass the gate`).toBe(true);
    }
  });

  test("ordinary public GETs (categories/collections/tags/colors/posts/system-texts) stay anonymous-OK", async () => {
    const paths = ["/api/v1/categories", "/api/v1/collections", "/api/v1/tags", "/api/v1/colors", "/api/v1/posts", "/api/v1/system-texts"];
    for (const path of paths) {
      expect((await anon.get(path)).ok(), `anon GET ${path} should be allowed`).toBe(true);
    }
  });

  test("a representative POST on every entity is gated: 401 anon, 401 foreign, passes for admin", async () => {
    const suffix = Math.random().toString(36).slice(2, 10);
    const writes: Array<[string, Record<string, unknown>]> = [
      ["/api/v1/categories", { title: { ru: `x-${suffix}`, en: `x-${suffix}` }, color: { color: "#000000" } }],
      ["/api/v1/collections", { title: { ru: `x-${suffix}`, en: `x-${suffix}` } }],
      ["/api/v1/tags", { name: { ru: `x-${suffix}`, en: `x-${suffix}` } }],
      ["/api/v1/colors", { color: "#010101" }],
      ["/api/v1/posts", { status: "Draft" }],
    ];

    for (const [path, data] of writes) {
      expect((await anon.post(path, { data })).status(), `anon POST ${path}`).toBe(401);
      expect((await foreignCtx.post(path, { data })).status(), `foreign-email POST ${path}`).toBe(401);

      const adminRes = await admin.post(path, { data });
      expect(adminRes.status(), `admin POST ${path} should pass the gate`).not.toBe(401);
      const body = await adminRes.json().catch(() => undefined);
      const id = body?.data?.id;
      if (id) await admin.delete(`${path}/${id}`);
    }
  });

  test("admin/comments write actions are gated: 401 anon, 401 foreign, pass for admin", async () => {
    const post = await createPost(admin, { status: "Published" });
    const comment = await admin
      .post(`/api/v1/posts/${post.id}/comments`, { data: { name: "A", text: "hi" } })
      .then((r) => r.json())
      .then((b) => b.data as { id: string });

    await expectError(await anon.patch(`/api/v1/admin/comments/${comment.id}/status`, { data: { status: "Approved" } }), 401);
    await expectError(await foreignCtx.patch(`/api/v1/admin/comments/${comment.id}/status`, { data: { status: "Approved" } }), 401);
    expect((await admin.patch(`/api/v1/admin/comments/${comment.id}/status`, { data: { status: "Approved" } })).ok()).toBe(true);

    await admin.delete(`/api/v1/admin/comments/${comment.id}`);
    await post.cleanup();
  });

  test("system-texts PATCH/DELETE are gated: 401 anon, 401 foreign, pass for admin", async () => {
    const code = `matrix_${Date.now()}`;
    const created = await admin
      .post("/api/v1/system-texts", { data: { code, content: { ru: "x", en: "x" } } })
      .then((r) => r.json())
      .then((b) => b.data as { id: string });

    // systemTextSchema requires `code` on every save, including edits — not optional on PATCH.
    await expectError(await anon.patch(`/api/v1/system-texts/${created.id}`, { data: { code, content: { ru: "y", en: "y" } } }), 401);
    await expectError(await foreignCtx.patch(`/api/v1/system-texts/${created.id}`, { data: { code, content: { ru: "y", en: "y" } } }), 401);
    expect((await admin.patch(`/api/v1/system-texts/${created.id}`, { data: { code, content: { ru: "y", en: "y" } } })).ok()).toBe(true);

    await expectError(await anon.delete(`/api/v1/system-texts/${created.id}`), 401);
    await expectError(await foreignCtx.delete(`/api/v1/system-texts/${created.id}`), 401);
    expect((await admin.delete(`/api/v1/system-texts/${created.id}`)).ok()).toBe(true);
  });

  test("the one documented exception: public POST /posts/:id/comments needs no token", async () => {
    const post = await createPost(admin, { status: "Published" });
    const res = await anon.post(`/api/v1/posts/${post.id}/comments`, { data: { name: "A", text: "no token needed" } });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    await admin.delete(`/api/v1/admin/comments/${body.data.id}`);
    await post.cleanup();
  });

  test("GET /posts?status=all: 401 anonymous, 200 (every status) for admin", async () => {
    await expectError(await anon.get("/api/v1/posts?status=all"), 401);
    expect((await admin.get("/api/v1/posts?status=all")).ok()).toBe(true);
  });
});

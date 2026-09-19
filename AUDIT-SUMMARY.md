# Audit Summary

Scope: full read of `src/` (backend, proxy, schema, storage, store, i18n, public pages, admin shell), configs, compose files, `.agents/`, and the older `audit_results.md` / `report.md`. Nothing was changed in code, migrations or configs. Details: `DEVIATIONS.md`, `PRODUCTION-READINESS.md`.

Not covered: line-by-line review of the admin CRUD pages and UI primitives, and runtime behavior (I executed nothing myself). Later you supplied the output of `npm audit`, `npm run lint`, `npx tsc --noEmit` and `next build` (`.claude/command-output/`); those results are included below.

## What is good

- **The layering is real.** Route → Controller → Service → Repository with interfaces on both service and repository sides, wired in one composition root (`container.ts`). Nine entities follow the same shape, which makes the code predictable and easy to extend.
- **Consistent contracts.** A single response envelope, a `BaseError` hierarchy with `serialize()`, Zod validation on every write path, and a slug-or-UUID resolver used across routes.
- **Auth design is solid.** HttpOnly SameSite=Strict cookies, refresh tokens stored hashed with rotation and family revocation, an access token of only 15 minutes, a server-side guard in `proxy.ts` (the client-side localStorage guard from the old report is gone), and no default JWT secret.
- **Data model is sensible.** Normalized join tables with cascade rules, 17 indexes on FKs/status, JSONB for localized fields, list queries with partial relation loading.
- **Product features from the plan are there**: localized content and DB-driven UI strings, category tree with drag-and-drop, media library with in-use protection, crop tool, drafts/publish/archive, moderated comments, slug URLs with redirect from UUIDs, hreflang/OpenGraph metadata, sitemap and robots.
- **Hygiene**: `strict: true`, `tsc --noEmit` clean, `next build` passes, no `dangerouslySetInnerHTML`, no `@ts-ignore`, secrets git-ignored and absent from history, parameterized SQL everywhere.
- **Most items from the two older audits are fixed**, see the table below.

## What is critical (fix before going public)

1. **Anonymous read access to admin data.** `proxy.ts` guards only mutating methods, so `GET /api/v1/users` (whole row including the `password` column), `GET /api/v1/admin/comments` (unmoderated comments) are public.
2. **Unpublished posts are public.** `GET /posts`, `/posts/:slug`, `/collections/:id/posts` do not filter by status; the UI's `status=Published` is the only barrier.
3. **Internal error text is returned to clients** (raw `error.message` in HTTP 500), and many bad inputs (non-UUID ids, malformed JSON, oversized `limit`) reach that path.
4. **Deployment safety switches**: `JWT_SECRET` is missing from the required-env list, and `NEXT_PUBLIC_DEV_MODE` (build-time, exposes `dev-login`) must be provably `false` in the production build.
5. **No rate limiting** on auth, upload, or public comments.
6. **Nothing to deploy yet**: no Dockerfile/app service, no migration step at deploy, bucket initialization never runs, and media URLs are stored absolute from `S3_ENDPOINT` (the public MinIO host must be decided first). Dockerfile is the chosen route for Coolify; nothing is deployed yet.
7. **Dependencies (`npm audit`: 20 findings, 1 critical).** `next@16.2.6` has 11 advisories including a Middleware/Proxy bypass, and `proxy.ts` is the only auth gate; `sharp@0.34.5` (high) processes every upload. Fixes: Next 16.3.5, sharp 0.35.4; do **not** run `npm audit fix --force` (it would downgrade `minio`). Most other findings come from the `shadcn` CLI sitting in `dependencies`.
8. **`/sitemap.xml` is prerendered at build time** from the DB (static in the build output), so it will be empty of posts in a Docker build and stale afterwards.

## What can wait

- Extracting an `AuthService` (token issuing is copy-pasted three times) and moving the direct DB access out of `CategoryService` / `MediaService`.
- Real `totalItems` in pagination; fixing the double-wrapped `/collections/:id/posts` response.
- OAuth hardening (`state`/PKCE, `email_verified`/`aud`), removing the "premature refresh" heuristic, purging old `token_sessions`.
- Self-referencing FKs (`categories.parent_id`, `comments.reply_id`); GIN/trigram search index; search on description as well as title.
- Media pipeline aligned with the plan (JPG conversion, 300/1200 px), magic-byte validation, storage interface (Adapter/Strategy).
- Public-page SSR for post content, `next/image` and `next/font`, replacing `import * as LucideIcons`, caching system texts.
- Making `npm run lint` green: it currently fails with 348 errors (321 `no-explicit-any`, 19 `set-state-in-effect`, 3 `no-require-imports`, 3 `no-empty-object-type`) and 77 warnings. Replacing 41 `console.*` calls with the logger, a `withErrorHandling` wrapper for controllers.
- Test suite (none exists; tooling is installed), security headers, Prettier.
- Documentation cleanup: stale `.agents/rules`, default README, leftover files (`scratch_findKeys.mjs`, `public/*.svg`, `old.*.png`).

## Status of earlier audit findings

| Finding (source) | Today |
|------------------|-------|
| Client-side admin guard via localStorage (report.md) | Fixed: `proxy.ts` verifies the JWT cookie |
| `getUserId` read `payload.id`, token had `userId` (report.md) | Fixed: uses `userId` and checks the user exists |
| Default JWT secret fallback (report.md) | Fixed; but `JWT_SECRET` is not in the required-env list |
| Category parent cycles (report.md) | Fixed in `CategoryService` (no DB constraint) |
| DB/MinIO init at module load (report.md) | DB fixed (lazy `getDb()`); `initializeBucket` is imported but never called |
| No indexes (report.md) | Fixed: 17 indexes |
| List over-fetching (report.md) | Fixed in `getByQuery` via `getListRelations()` |
| Infinite scroll in local state (report.md) | Fixed on the public page (RTK `merge`); admin dashboard still merges locally |
| Category nav via `<button>` (report.md) | Fixed: `<Link href>` |
| UUID in project URLs (report.md) | Fixed: `/projects/[slug]`, UUID redirects to slug |
| Public comments blocked by proxy (audit_results.md) | Fixed: explicit exception in `proxy.ts` |
| No rate limiting (audit_results.md) | **Open** |
| Aggressive premature-refresh (both) | **Open** |
| JSONB `ILIKE` without GIN (both) | **Open** |
| `proxy.ts` instead of `middleware.ts` (audit_results.md) | Not an issue: `proxy` is the Next 16 name (`node_modules/next/dist/docs/.../version-16.md`) |

## Next steps

Open items that wait on the user are tracked in `CHANGE-PLAN.md` (CP-1, CP-2).

1. Close the blockers: gate `GET` on users/admin comments (or move them behind the auth check), default `status=Published` for anonymous post reads (allow other statuses only with a valid token), generic 500 messages, add `JWT_SECRET` to the env whitelist, guard `dev-login` with `NODE_ENV` as well.
2. Dependencies (you run them): upgrade Next and sharp, `npm audit fix` without `--force`, move `shadcn` to `devDependencies`, rebuild, re-run `npm audit --omit=dev` (plan in `PRODUCTION-READINESS.md`). Tell me whether the Next proxy-bypass advisory (GHSA-6gpp-xcg3-4w24) matches this setup.
3. The deployment shape is decided (Dockerfile). Still to decide: the public MinIO URL and the migration step; then the Dockerfile, health endpoint, `standalone` config and a dynamic sitemap.
4. Add rate limiting (Traefik middleware or `proxy.ts`).
5. Write the first tests around the blockers: proxy auth matrix, post visibility, token rotation. They protect against regressions of exactly what was found here.
6. Then the "can wait" list, roughly top to bottom.

Note: these are recommendations only; no code was edited, per the constraints of this task. Tell me which fixes you want implemented.

# Audit Summary

Scope: full read of `src/` (backend, proxy, schema, storage, store, i18n, public pages, admin shell), configs, compose files, `.agents/`, and the older `audit_results.md` / `report.md`. At the time of the audit nothing was changed in code, migrations or configs; the fixes applied afterwards (2026-09-19 and 2026-09-23) are listed under "Fixes applied". Details: `DEVIATIONS.md`, `PRODUCTION-READINESS.md`.

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

Items 1–4 were fixed in code on 2026-09-19 (not yet verified by hand, `CHANGE-PLAN.md` CP-4) and items 5 and 8 on 2026-09-23 (checked by scripts and in a browser); item 6 is partly done. See "Fixes applied". They stay listed so the history is readable.

1. **[Fixed 2026-09-19] Anonymous read access to admin data.** `proxy.ts` guards only mutating methods, so `GET /api/v1/users` (whole row including the `password` column), `GET /api/v1/admin/comments` (unmoderated comments) are public.
2. **[Fixed 2026-09-19] Unpublished posts are public.** `GET /posts`, `/posts/:slug`, `/collections/:id/posts` do not filter by status; the UI's `status=Published` is the only barrier.
3. **[Fixed 2026-09-19, error text only] Internal error text is returned to clients** (raw `error.message` in HTTP 500), and many bad inputs (non-UUID ids, malformed JSON, oversized `limit`) reach that path (those inputs still end in 500, now with a generic message).
4. **[Fixed 2026-09-19] Deployment safety switches**: `JWT_SECRET` is missing from the required-env list, and `NEXT_PUBLIC_DEV_MODE` (build-time, exposes `dev-login`) must be provably `false` in the production build. Now `JWT_SECRET` is required at start and `dev-login` also refuses `NODE_ENV=production`; the build variable itself still has to be `false`.
5. **[Fixed 2026-09-23] No rate limiting** on auth, upload, or public comments (and no upper bound for `limit`). Now: 20 auth requests per minute, 30 uploads per minute, 5 comments per 10 minutes per client address, `limit` capped at 100; in memory, so for a single instance.
6. **Nothing to deploy yet**: no Dockerfile/app service and no migration step at deploy. Dockerfile is the chosen route for Coolify; nothing is deployed yet. The bucket is now prepared before the first upload (`ensureBucket()`) and image URLs come from the required `S3_PUBLIC_URL` instead of `S3_ENDPOINT` (fixed 2026-09-23); the public address itself is chosen later (CP-8).
7. **Dependencies (`npm audit`: 20 findings on 2026-09-19, 28 on 2026-09-23, 1 critical; the extra ones are dev tooling, CP-2).** `next@16.2.6` has 11 advisories including a Middleware/Proxy bypass (GHSA-6gpp-xcg3-4w24: needs Turbopack and a single `config.i18n.locales` entry, so most likely not applicable here, CP-1), and `proxy.ts` is still the only auth gate; `sharp@0.34.5` (high) processes every upload. Fixes: Next 16.3.5, sharp 0.35.4; do **not** run `npm audit fix --force` (it would downgrade `minio`). Most other findings come from the `shadcn` CLI sitting in `dependencies`.
8. **[Fixed 2026-09-23] `/sitemap.xml` was prerendered at build time** from the DB, so it would be empty of posts in a Docker build and stale afterwards. It is now built on each request (`force-dynamic`), and `next build` passes without a reachable database.

## What can wait

- ~~Extracting an `AuthService` (token issuing is copy-pasted three times) and moving the direct DB access out of `CategoryService` / `MediaService`.~~ Done 2026-10-02 (second round): `issueSession()` and the new repository count methods, see "Fixes applied" below.
- Real `totalItems` in pagination; fixing the double-wrapped `/collections/:id/posts` response.
- Removing the "premature refresh" heuristic (still open; presented 2026-09-28 and again 2026-10-01, not selected either time). (The OAuth hardening, `state`/PKCE and the ID-token checks, was done on 2026-09-23; purging old `token_sessions` was done 2026-10-01, see "Fixes applied" below.)
- Self-referencing FKs (`categories.parent_id`, `comments.reply_id`); GIN/trigram search index; search on description as well as title.
- Media pipeline aligned with the plan (JPG conversion, 300/1200 px), storage interface (Adapter/Strategy). Magic-byte validation was done 2026-09-28 (see "Fixes applied" → round 2).
- Public-page SSR for post content, `next/image` and `next/font`, replacing `import * as LucideIcons`, caching system texts.
- Making `npm run lint` green: it currently fails with 345 errors (318 `no-explicit-any`, 19 `set-state-in-effect`, 3 `no-require-imports`, 3 `no-empty-object-type`) and 73 warnings (2026-09-23). Replacing the remaining 34 of 40 `console.*` calls with the logger (6 done 2026-10-02; the rest are in client components, where winston can't run — a separate decision, `CHANGE-PLAN.md` CP-18), a `withErrorHandling` wrapper for controllers.
- Test suite (none exists; tooling is installed), Prettier. A nonce-based (strict) CSP, on top of the baseline one added 2026-09-28.
- Documentation cleanup: stale `.agents/rules`, default README, leftover files (`scratch_findKeys.mjs`, `public/*.svg`, `old.*.png`).

## Fixes applied (2026-09-19)

Applied at the owner's request after the audit, one point at a time. `npx tsc --noEmit` is clean afterwards. Nothing was run end to end (no build, lint or manual test), so treat the fixes as unverified until CP-4 is done. No migration or config was changed.

| Point | Files |
|-------|-------|
| Anonymous admin reads (B1, B2) | `src/proxy.ts` (JWT for every method on `/api/v1/users/**` and `/api/v1/admin/**`), `src/repositories/drizzle/userRepository.ts` (`populate()` returns id/email/name only) |
| Unpublished posts (B3) | `src/utils/auth.ts` (`isAdminRequest`), new `src/utils/postVisibility.ts`, `src/controllers/postController.ts`, `src/app/api/v1/collections/[id]/posts/route.ts`, `src/app/[locale]/(public)/projects/[slug]/layout.tsx` |
| Leaking 500s (B4) | `src/utils/apiResponse.ts` |
| Env and dev-login (B5, B6) | `src/modules/core/env.ts`, `src/app/api/v1/auth/dev-login/route.ts` |

Found while fixing, not in the earlier audit: the server-rendered metadata of a project page leaked draft titles and OG data; Drizzle errors exposed the SQL text and parameters in 500 responses; the claim "`proxy.ts` throws when `JWT_SECRET` is missing" was wrong (it failed closed); the `password` column only ever held a constant placeholder. Deliberately not done: a second authorization layer in the controllers (CP-5), 4xx for bad UUIDs and malformed JSON (CP-6). The `limit` cap was done later, on 2026-09-23.

## Fixes applied (2026-09-23)

Applied one point at a time at the owner's request (commits `840bc10`, `b5dc337`, `fd0293b`, `2aa754b`). Checked with `tsc --noEmit` (clean), `next build` (passes), scripted checks and a browser, and by the owner logging in through Google. One new dependency (`rate-limiter-flexible`); `config/test.env` got an `S3_PUBLIC_URL` line from the owner; no migration changed.

| Point | Files |
|-------|-------|
| Sitemap built per request (item 8) | `src/app/sitemap.ts` |
| Rate limiting and the `limit` cap (item 5) | `src/proxy.ts`, new `src/utils/rateLimit.ts`, new `src/common/errors/tooManyRequests.ts`, `src/utils/paginationUtils.ts` (`MAX_PAGE_SIZE = 100`), `src/controllers/postController.ts` (default 20 per page), `src/controllers/categoryController.ts` (shared pagination helper), `package.json` / `package-lock.json` |
| Public image URL and bucket (part of item 6) | `src/modules/core/env.ts` (`S3_PUBLIC_URL`), `src/modules/storage/StorageService.ts`, `src/modules/storage/minioClient.ts` (`ensureBucket()`), `src/modules/core/container.ts` (dead import removed) |
| Google login hardening | new `src/utils/googleOAuth.ts`, new `src/app/api/v1/auth/google/start/route.ts`, `src/app/api/v1/auth/google/exchange/route.ts`, `src/app/admin/login/page.tsx`, `src/common/validation/schemas.ts`; `src/app/api/v1/auth/config/route.ts` removed |

Found while working: `S3_ENDPOINT` served both as the server's connection address and as the public image address; `GOOGLE_CALLBACK_URL` was required but unused and held a placeholder locally; `S3_FORCE_PATH_STYLE` was required but unused; deleting a media row left its files in the bucket; the infinite scroll sent one extra request for an empty page. All four were fixed 2026-09-28 (CP-7 in round 1, the rest in round 2, below).

## Fixes applied (2026-09-28)

Two rounds the same day, each applied one point at a time at the owner's request.

### Round 1

Checked with `tsc --noEmit` (clean), `next build` (passes, 28 pages), and a headless-browser console check for CSP violations. No new dependency, no migration or config changed.

| Point | Files |
|-------|-------|
| Public `GET /media` closed (B12) | `src/proxy.ts` (`isAdminOnlyResource` now matches `/api/v1/media(/|$)` too) |
| Security headers / baseline CSP | `next.config.ts` (`headers()`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Content-Security-Policy`) |
| `replyToComment` 404 instead of 500 | `src/services/commentService.ts` (`NotFoundError` instead of a plain `Error`) |
| CP-7: infinite scroll extra empty-page request | `src/app/[locale]/(public)/page.tsx`, `src/app/admin/dashboard/page.tsx`, `src/app/admin/tags/page.tsx`, `src/app/admin/comments/page.tsx` (`hasMore` derived at render from `meta.nextPage` instead of `useState` + a sync effect) |

Found while working: `GET /media`'s only consumer in the codebase is the admin media picker (`admin/projects/[id]/page.tsx`) — the public site never called it, so gating it behind a JWT breaks nothing. The CSP keeps `script-src`/`style-src` `'unsafe-inline'` (App Router RSC streaming and framer-motion inline styles need it) and is not nonce-based; a strict CSP is a separate, bigger task (`PRODUCTION-READINESS.md` → XSS).

### Round 2

Checked with `tsc --noEmit` (clean), `next build` (passes), and scripted checks run directly against the local dev DB/MinIO (self-cleaning: test rows/objects created and removed by the scripts themselves). No new dependency, no migration or config changed.

| Point | Files |
|-------|-------|
| Dashboard silently showed only published posts after token expiry | `src/utils/postVisibility.ts` (`resolveStatusFilter` treats `status=all` as the admin's explicit request for everything: no filter if admin, 401 otherwise), `src/app/admin/dashboard/page.tsx` (now sends `status: "all"`) |
| `MediaService.deleteMedia` left files in the bucket | `src/modules/storage/StorageService.ts` (new `deleteImage()`, best-effort, skips external URLs), `src/services/mediaService.ts` |
| Unused required env vars | `src/modules/core/env.ts` (`S3_FORCE_PATH_STYLE`, `GOOGLE_CALLBACK_URL` dropped from `requiredEnvVars` and the `env` object; 32 required variables now) |
| `POST /users` always failed (`password` NOT NULL) | `src/services/userService.ts` (`saveUser` sets the same placeholder the Google login route uses) |
| Upload trusted client MIME/extension | `src/modules/storage/StorageService.ts` (`uploadImage` derives format, extension and `Content-Type` from `sharp(buffer).metadata()`; an unsupported/undecodable file is a `ValidationError` 400), `src/services/mediaService.ts` (stopped forwarding the now-unused client MIME type) |

Found while working: the four checks above were run as real create → verify → delete cycles against the local Postgres/MinIO (a locally-minted JWT for the auth-gated checks), not just `tsc`/`build`. Verified specifically: `status=all` gives 401 anonymously and 200 for a real admin token, while every other status value's existing (already-verified) B3 behavior is untouched; `deleteMedia` leaves zero objects behind (both `statObject` calls return `NotFound` after delete); `saveUser` no longer hits the `NOT NULL` constraint; a real PNG under a spoofed `.txt` name is accepted and stored as `.png`, garbage bytes claiming to be PNG are rejected with 400, and a real JPEG is accepted and stored as `.jpg`.

## Fixes applied (2026-10-01)

Four issues picked from a third backlog list (numbered 21–25 in that pass; issue 25, `meta.totalItems`/`GET /collections/:id/posts` not using the shared `paginate()`, was presented but not selected). Checked with `tsc --noEmit` (clean), `next build` (passes), scripted create/verify/delete checks against the local dev Postgres (self-cleaning), and HTTP checks against a temporary `next start` server with a locally-minted admin JWT. No new dependency, no migration or config changed.

| Point | Files |
|-------|-------|
| `createComment` didn't check `postId` existed | `src/services/commentService.ts` (checks `postRepo.getById(postId)`, throws `NotFoundError`), `src/modules/core/container.ts` (`CommentService` now takes `postRepo` too) |
| `POST/PUT/DELETE /api/v1/users` unrestricted and unused | `src/app/api/v1/users/route.ts`, `src/app/api/v1/users/[id]/route.ts` (write methods removed), `src/controllers/userController.ts`, `src/services/userService.ts`, `src/services/interfaces.ts` (`saveUser`/`deleteUser` removed), `src/common/validation/schemas.ts` (`userSchema` removed, now unused) |
| `token_sessions` rows never purged | `src/repositories/drizzle/tokenRepository.ts` (new `deleteExpired()`, deletes only rows past `expiresAt`), `src/app/api/v1/auth/refresh/route.ts`, `src/app/api/v1/auth/google/exchange/route.ts` (call it after issuing a new session) |
| `search` didn't escape `%`/`_` in `ILIKE` | `src/repositories/drizzle/postRepository.ts` (escapes `%`, `_`, `\` before wrapping the term) |

Found while working: `comments.reply_id` has **no FK constraint at all** in the schema (only `post_id` does), so unlike the `postId` fix, a bogus `replyId` doesn't error — it is silently stored as a dangling reference; left open (same bucket as the other missing self-referencing FKs, `categories.parent_id`). `google/exchange/route.ts` auto-provisions users by calling `userRepository.save()` directly, never through `UserService`, so removing `saveUser`/`POST /users` could not affect login. Verified specifically: a bogus `postId` now 404s and a real one still works (regression-checked end to end through the public comment route); `POST/PUT/DELETE /api/v1/users` now answer 405 (method not implemented) instead of succeeding; `deleteExpired()` removes a session row seeded 1 minute past `expiresAt` but leaves an `isUsed=true` row that isn't expired yet untouched; `search=%` and `search=_` now match 0 of 5 dev-DB posts instead of all 5.

## Fixes applied (2026-10-02)

Two rounds the same day, each picked from its own backlog list and applied one point at a time at the owner's request.

### Round 1

Five issues picked from a fourth backlog list (numbered 26–30 in that pass). Two of them (28, 29) were first presented with a narrower framing the owner pushed back on — the shipped behavior below is the revised one, not the original draft. Checked with `tsc --noEmit` (clean), `next build` (passes), a locally-minted-JWT test matrix against a temporary `next start` server, and scripted checks against the local dev Postgres (self-cleaning). No new dependency, no migration changed (one seed data file deleted, not a schema migration).

| Point | Files |
|-------|-------|
| `createComment` didn't check `replyId` existed (closes the gap found while working on 2026-10-01) | `src/services/commentService.ts` (checks `commentRepo.getById(replyId)` when provided, throws `NotFoundError`) |
| Access tokens trusted forever even after `ADMIN_EMAILS` removal | `src/utils/jwt.ts` (`email` in the payload, new `verifyAdminToken()`/`isAllowedAdminEmail()`/`signAccessToken()`), `src/utils/auth.ts`, `src/proxy.ts` (both guards call `verifyAdminToken()`, local `getJwtSecret` removed), `src/app/api/v1/auth/google/exchange/route.ts`, `src/app/api/v1/auth/dev-login/route.ts`, `src/app/api/v1/auth/refresh/route.ts` (re-checks the email on every rotation, revokes the family if no longer allowed; the "premature refresh" check now only fires for a token `verifyAdminToken` would still accept) |
| Admin-only writes other than uploads had no rate limit | `src/utils/rateLimit.ts` (`RATE_LIMITS.adminWrite`, 300/min), `src/proxy.ts` (`resolveRateLimitRule`, plus a `MUTATING_METHODS` constant reused to remove an inline duplicate array already in the file) |
| No cap on files per upload request | `src/services/mediaService.ts` (`MAX_FILES_PER_UPLOAD`, optional env var, default 50) |
| `seeds/initial-data/users.json` committed a password-shaped value, unused by any loader | file deleted |

Found while working, not yet fixed (see `PRODUCTION-READINESS.md` → Input validation, `DEVIATIONS.md` → Media / Frontend (Admin), `CHANGE-PLAN.md` CP-16): Next's `experimental.proxyClientMaxBodySize` defaults to 10 MB and silently truncates any request body over that for every route behind `proxy.ts`, turning a large upload into a raw 500 instead of a clean error (confirmed with a 12 MB file and with two 8.7 MB files in one request); and the admin media library page bypasses RTK Query (raw `fetch`), so it lacks silent token refresh, cache invalidation, and per-file error reporting that every other admin page gets. Verified specifically: a locally-minted-JWT matrix (good/uppercase-email/no-email/foreign-email/wrong-role/no-token) against `GET /users`, `GET /admin/dashboard` and `GET /posts?status=all` behaves as expected in every case; a refresh with a pre-claim access token upgrades transparently (200, new token carries `email`); a refresh for a user removed from `ADMIN_EMAILS` is rejected and the family revoked; a normal admin write and the public anonymous comment route are unaffected; 300 rate-limited requests pass and the 301st gets 429; 51 files in one upload request are rejected before any processing, 50 are all accepted (then cleaned up).

### Round 2

Five issues picked from a fifth backlog list (numbered 31–35 in that pass), all five approved together ("давай делаем все, будь предельно внимателен"). Checked with `tsc --noEmit` (clean), `next build` (passes, same 40 routes), HTTP checks against a temporary `next dev` server, and a headless-browser (Playwright) check. No new dependency, no migration.

| Point | Files |
|-------|-------|
| Malformed JSON and non-UUID ids ended in a raw 500 | New `parseJsonBody()` (`src/utils/validateRequest.ts`), applied at all 11 `request.json()` call sites across 9 controllers; `categoryController.reorderCategories`'s separate `.parse()` call routed through `validateRequest` too; `isUUID` guard added to `DrizzleBaseRepository.getById`/`getByIds`/`delete` and to the repositories that override them (`categoryRepository.ts`, `postRepository.ts`, `commentRepository.ts`, `systemTextRepository.ts`) |
| `CategoryService.deleteCategory`/`MediaService.deleteMedia` ran raw Drizzle queries instead of going through a repository | New `CategoryRepository.countChildren`, `PostRepository.countByCategory`/`countByPoster`/`countGalleryUsage` (added to `ICategoryRepository`/`IPostRepository`); `src/services/categoryService.ts`, `src/services/mediaService.ts`, `src/modules/core/container.ts` (`CategoryService` now also takes `postRepo`) |
| Token-issuing code copied across three auth routes | New `issueSession(userId, email, tokenFamily?)` (`src/utils/authSession.ts`); `src/app/api/v1/auth/{google/exchange,dev-login,refresh}/route.ts` each call it instead of minting/hashing/setting cookies themselves |
| Raw `<img>` in the public project gallery (scoped down from all 7 to just this one, by agreement — the other 6 are admin-only or drag/crop widgets where `next/image` fights CSS transforms) | `src/app/[locale]/(public)/projects/[slug]/page.tsx` (now `next/image`, carrying `width`/`height` from the `media` row), `next.config.ts` (`images.remotePatterns` for the `S3_PUBLIC_URL` host, plus a dev-only `images.dangerouslyAllowLocalIP` — an unplanned but necessary follow-on found while verifying, since Next 16 refuses to optimize an image resolving to a private IP, which `localhost` always does locally) |
| `console.*` bypassing the logger | 6 of the 40 sites converted (`src/app/sitemap.ts`, `src/app/[locale]/(public)/projects/[slug]/layout.tsx`, `src/utils/slug.ts`, `src/services/tagService.ts`, 2 in `src/app/api/v1/auth/refresh/route.ts`) — the remaining ~34 are inside `"use client"` components, where winston cannot run; left as `console.*`, tracked as its own decision in `CHANGE-PLAN.md` CP-18 |

Found while working: the `console.*` item was originally framed (in the backlog pass, and in CP-18) as "40 easy swaps" — checking which call sites are actually client components (grep + a `"use client"` check on every file) showed only 6 are safely fixable without new client-side logging infrastructure; the other 34 are a distinct, larger gap, not a quick finish. Verified specifically: a full `dev-login` → `refresh` (rotation) → replay-old-refresh-token (reuse detection) → confirm-whole-family-revoked HTTP sequence against a temporary server (confirms `issueSession` end-to-end, including that the new access token still carries `email`); malformed JSON and non-UUID/nonexistent ids now return clean 400/404 across colors, media, tags, collections, system-texts and categories (previously 500); a `categories/reorder` malformed-JSON-and-bad-UUID check; real dev-DB regression checks for all three delete-conflict business rules (category-has-children, media-is-poster, media-in-gallery, all still 409 as before); a Playwright check of the gallery page confirming `next/image` generates proper `<img>` tags (`loading="lazy"`, populated `srcset`), the `/_next/image` optimizer returns a real re-encoded JPEG (not a 400), and there are zero browser console errors.

## Status of earlier audit findings

| Finding (source) | Today |
|------------------|-------|
| Client-side admin guard via localStorage (report.md) | Fixed: `proxy.ts` verifies the JWT cookie |
| `getUserId` read `payload.id`, token had `userId` (report.md) | Fixed: uses `userId` and checks the user exists |
| Default JWT secret fallback (report.md) | Fixed; `JWT_SECRET` is in the required-env list since 2026-09-19 |
| Category parent cycles (report.md) | Fixed in `CategoryService` (no DB constraint) |
| DB/MinIO init at module load (report.md) | DB fixed (lazy `getDb()`); MinIO: `ensureBucket()` prepares the bucket lazily before the first upload (2026-09-23, `initializeBucket` was removed) |
| No indexes (report.md) | Fixed: 17 indexes |
| List over-fetching (report.md) | Fixed in `getByQuery` via `getListRelations()` |
| Infinite scroll in local state (report.md) | Fixed on the public page (RTK `merge`); admin dashboard still merges locally |
| Category nav via `<button>` (report.md) | Fixed: `<Link href>` |
| UUID in project URLs (report.md) | Fixed: `/projects/[slug]`, UUID redirects to slug |
| Public comments blocked by proxy (audit_results.md) | Fixed: explicit exception in `proxy.ts` |
| No rate limiting (audit_results.md) | Fixed 2026-09-23 for auth, upload and public comments (in memory, single instance); ordinary GETs are not limited |
| Aggressive premature-refresh (both) | **Open** |
| JSONB `ILIKE` without GIN (both) | **Open** |
| `proxy.ts` instead of `middleware.ts` (audit_results.md) | Not an issue: `proxy` is the Next 16 name (`node_modules/next/dist/docs/.../version-16.md`) |

## Next steps

Open items that wait on the user are tracked in `CHANGE-PLAN.md` (CP-2, CP-4; CP-8 waits for a domain and a server).

1. Done 2026-09-19 (B1–B6, see "Fixes applied"): verify them by hand (CP-4). Still open from that group: 4xx for invalid UUIDs and malformed JSON (CP-6), and the second authorization layer in controllers (CP-5, after the Next upgrade).
2. Dependencies (you run them): upgrade Next and sharp, `npm audit fix` without `--force`, move `shadcn` to `devDependencies`, rebuild, re-run `npm audit --omit=dev` (plan in `PRODUCTION-READINESS.md`). The Next proxy-bypass advisory (GHSA-6gpp-xcg3-4w24) most likely does not match this setup (CP-1, answered 2026-09-19); the other advisories still need the upgrade.
3. The deployment shape is decided (Dockerfile). Still to decide: the migration step. Then the Dockerfile, health endpoint and `standalone` config (the sitemap is already dynamic and the build needs no database). The public MinIO address is set later through `S3_PUBLIC_URL` (CP-8), together with the Google redirect URI for the production domain.
4. Rate limiting is in place (in memory, one instance); at deploy time add Traefik's rate-limit middleware for ordinary GETs and revisit the client-address rule if a proxy such as Cloudflare is put in front.
5. Write the first tests around the blockers: proxy auth matrix, post visibility, token rotation. They protect against regressions of exactly what was found here.
6. Then the "can wait" list, roughly top to bottom.

Note: apart from the fixes listed under "Fixes applied", these are recommendations only. Tell me which of the rest you want implemented.

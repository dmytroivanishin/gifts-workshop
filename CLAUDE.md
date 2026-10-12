# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Canonical reference for this repo.** The current code in `src/` is the source of truth. `docs/project-plan/*` is intent and may be outdated; where they disagree, the code wins (differences are catalogued in `DEVIATIONS.md`).

> **This is NOT the Next.js you know.** This project runs Next.js 16 with breaking changes: APIs, conventions and file structure may differ from your training data (for example, `middleware.ts` is now `proxy.ts`). Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code, and heed deprecation notices.

## Working agreements

- **Open steps live in `CHANGE-PLAN.md`** (imported below, so it is always in context). At the start of a session, and before new work, remind the user of the open items that wait on them (ID + what is needed), and update the plan when an item is answered or completed.
- **Dependencies.** Adding a new npm package is allowed once the user has agreed to adding one (2026-09-23). Announce the exact command first; before installing check the package with `npm view` (version, license, dependencies, install scripts, last publish); afterwards show the diff of `package.json` and `package-lock.json`. Never `--force`, never any `npm audit fix` without an explicit request. Upgrading existing packages (`next`, `sharp`, …) stays with the user (`CHANGE-PLAN.md` CP-2). `npm audit` and `npm outdated` are also run by the user, who pastes the output; do not run them unprompted. `.claude/settings.json` enforces this: `npm install/uninstall/update` always ask for approval, and `--force` and `npm audit fix` are denied.
- Saved command outputs live in `.claude/command-output/` (git-ignored); read them from there, and ask for a fresh run when the code or lockfile is newer than the file.
- Do not add or change code beyond what was asked; audits and docs work is documentation-only unless told otherwise. The one exception is the next bullet.
- **Leave the code you touch better (approved by the user, 2026-09-23).** When a change touches code that re-implements something the repo already has a shared helper for (for example a controller parsing `page`/`limit` by hand instead of `getPaginationParams`), switch it to the helper. Put a fix that many callers need into the shared place, not into each caller (the `limit` cap lives in `utils/paginationUtils.ts`, so every list endpoint gets it). Keep this inside the files and behaviour the task already touches, list it in the report, and ask before a wider refactor.
- Every external input goes through Zod; no `any` (use `unknown`), explicit return types, `interface` for shapes / `type` for unions, `as const` over `enum`, functional style, comments explain "why" only. Existing code violates some of these (see §11); do not copy the violations into new code.

---

## 1. Project Summary

**Purpose:** a handmade-goods portfolio (soft toys, dolls, textiles, kitchen textiles; brand "Добрые подарки / Kind Gifts") with a public catalog and a single-admin CMS. Content is localized (ru/en, configurable).

**Stack**
- Next.js 16.2 (App Router, TypeScript strict), React 19.2. Frontend and backend live in one Next app (route handlers under `src/app/api/v1`).
- PostgreSQL 16 + Drizzle ORM (`drizzle-orm`, `postgres` driver, `drizzle-kit`).
- File storage: MinIO (S3-compatible, `minio` client) + `sharp` for image processing. DB browser: pgweb (dev only).
- Auth: Google OAuth (authorization code with `state` and PKCE, ID token verified) → own JWT (`jose`) in HttpOnly cookies, restricted to `ADMIN_EMAILS`. Rate limiting: `rate-limiter-flexible` (in memory) in `proxy.ts`.
- State: Redux Toolkit + RTK Query (`src/store`). Forms: react-hook-form + zod 4.
- UI: Tailwind CSS 4, shadcn/ui (style `radix-nova`, Radix), lucide-react, react-icons, framer-motion, dnd-kit (drag-and-drop), sonner (toasts). No dark mode.
- Logging: winston (JSON to stdout).
- Infra: Docker Compose for local dev; production target is a VPS with Coolify, deployed from a Dockerfile (neither exists yet; nothing is deployed).

**Status**
- Core feature set is implemented: public catalog + project pages, admin CMS (projects, categories, collections, tags, colors, media, comments, localization), Google login, uploads, i18n, SEO metadata/sitemap.
- **Not production-ready**: security blockers, no deployment config, no tests. See §11–12.
- Checked 2026-09-23: `next build` passes (also without a reachable database), `tsc --noEmit` is clean, `npm run lint` fails (345 errors, 73 warnings), `npm audit` reports 28 findings (1 critical, on Next; the 8 names added since 2026-09-19 are dev tooling, `CHANGE-PLAN.md` CP-2).
- 2026-09-19: blockers B1–B6 (anonymous reads of admin data, unpublished posts, leaking 500s, `JWT_SECRET` and dev-login guards) are fixed in code but not yet verified by hand (`CHANGE-PLAN.md` CP-4).
- 2026-09-23: rate limiting with a `limit` cap (B7), a dynamic sitemap (B11), `S3_PUBLIC_URL` with lazy bucket creation (B9) and the Google login hardening (`state`, PKCE, verified ID token) are fixed in code and checked by scripts and in a browser; the owner logged in through Google by hand. Open blockers: B8 (Dockerfile) and B10 (Next/sharp upgrade).
- 2026-09-28: `GET /api/v1/media` (list and by id) requires a JWT like `/users/**` and `/admin/**` (B12; it was public and leaked images of unpublished posts, its only consumer is the admin media picker); a baseline `Content-Security-Policy` plus `X-Content-Type-Options`/`Referrer-Policy`/`X-Frame-Options`/`Permissions-Policy` were added in `next.config.ts`; `CommentService.replyToComment` now throws `NotFoundError` (404) instead of a plain `Error` (500); the infinite-scroll extra empty-page request is fixed on the public page, dashboard, tags and comments (CP-7). `tsc --noEmit` and `next build` re-run clean; lint and `npm audit` were not re-run (no dependency changes), so the 2026-09-23 numbers still stand.
- Also 2026-09-28 (second round the same day): the admin dashboard now sends an explicit `status=all` and `resolveStatusFilter` answers 401 for it without a valid admin token, instead of silently narrowing to `Published` after the access token expires; `MediaService.deleteMedia` now removes both objects from MinIO (previously only the DB row); `S3_FORCE_PATH_STYLE` and `GOOGLE_CALLBACK_URL` are dropped from `requiredEnvVars` (unused, 32 variables now); `UserService.saveUser` sets the same placeholder password the Google login route uses to provision users, so `POST /users` no longer fails on the `NOT NULL` constraint; upload validation now derives the real format from `sharp(buffer).metadata()` instead of trusting the client's MIME type/filename, so a spoofed or undecodable file is a 400 (`ValidationError`), not a 500. `tsc --noEmit` and `next build` re-run clean; verified with scripted checks against the local dev DB/MinIO (self-cleaning).
- 2026-10-01: `CommentService.createComment` now checks the post exists before inserting (`NotFoundError`, 404, instead of an uncaught FK-violation 500); `POST/PUT/DELETE /api/v1/users` were removed entirely — dead code with zero UI consumers and no role model worth restricting — along with `saveUser`/`deleteUser` in the service/controller/`IUserService` and the now-unused `userSchema` (only `GET /users` and `GET /users/:id` remain, same JWT gate as before); `TokenRepository.deleteExpired()` now purges `token_sessions` rows past `expiresAt` opportunistically on every login/refresh, while a still-unexpired `isUsed` row is left alone so reuse detection keeps working; `GET /posts`'s `search` now escapes `%`/`_`/`\` before the `ILIKE` pattern, so a literal wildcard character in a search term is matched literally instead of as a SQL wildcard. `tsc --noEmit` and `next build` re-run clean; verified with scripted checks against the local dev DB (self-cleaning) plus HTTP checks against a temporary server.
- 2026-10-02: `CommentService.createComment` also checks `replyId` when one is given (`NotFoundError` if it doesn't exist — `comments.reply_id` has no FK at all, so a bad value used to be stored silently instead of erroring); the access-token JWT now carries `email`, and `verifyAdminToken()` (`utils/jwt.ts`) re-checks it against the current `ADMIN_EMAILS` on every request (`proxy.ts`, `isAdminRequest()`, `getUserId()`) and on every refresh rotation, so removing an admin's email takes effect immediately instead of after up to 7 days of a still-working refresh chain; a new `adminWrite` rate limit (300/minute per address) now covers every other authenticated write, sized loose on purpose so normal 1-2 person admin work is never throttled; `MediaService.uploadMultiple` caps files per request at `MAX_FILES_PER_UPLOAD` (optional env var, default 50); the unused `seeds/initial-data/users.json` was deleted. `tsc --noEmit` and `next build` re-run clean; verified with a locally-minted-JWT test matrix against a temporary server (good/no-email/foreign-email/wrong-role tokens, refresh-rotation upgrade and allowlist-removal cases) and scripted upload/rate-limit checks (self-cleaning). Also found while working (not yet fixed): `next.config.ts` doesn't set `experimental.proxyClientMaxBodySize`, so Next's 10 MB default silently truncates any request body over that for every route behind `proxy.ts`, which can turn a large upload into a raw 500 instead of a clean "file too large"; and the admin media library page bypasses RTK Query (raw `fetch`), so it lacks silent token refresh and cache invalidation. Both are recorded in `PRODUCTION-READINESS.md` / `DEVIATIONS.md` and planned as a separate round (`CHANGE-PLAN.md` CP-16).
- 2026-10-02 (second round the same day): a malformed JSON body now returns a clean `ValidationError` (400) instead of an uncaught 500 (new `parseJsonBody()` in `utils/validateRequest.ts`, used by all 9 controllers that parse a body); a non-UUID id passed to any `getById`/`getByIds`/`delete` now short-circuits to "not found" instead of Postgres throwing `invalid input syntax for type uuid` (guard added to `DrizzleBaseRepository` and to the repositories that override those methods: `CategoryRepository`, `PostRepository`, `CommentRepository`, `SystemTextRepository`); `CategoryService.deleteCategory`/`MediaService.deleteMedia` no longer run raw Drizzle queries themselves, they call new repository methods (`CategoryRepository.countChildren`, `PostRepository.countByCategory`/`countByPoster`/`countGalleryUsage`); the three auth routes' duplicated token-mint/cookie-setting code is now one shared `issueSession()` (`utils/authSession.ts`); the public project gallery (`projects/[slug]/page.tsx`) uses `next/image` instead of a raw `<img>` (`next.config.ts` gained `images.remotePatterns` for the MinIO host and a dev-only `images.dangerouslyAllowLocalIP`, since Next 16 refuses by default to optimize an image whose host resolves to a private IP, which `localhost` always does locally); 6 of the 40 `console.*` call sites are now `logger` calls — only the genuinely server-side ones, since winston cannot run in the ~34 client-component (`"use client"`) call sites, a distinct gap tracked in `CHANGE-PLAN.md` CP-18. `tsc --noEmit` and `next build` re-run clean; verified with HTTP checks (malformed JSON and non-UUID ids now 400/404 across colors/media/tags/collections/system-texts/categories), a full dev-login → refresh-rotation → reuse-detection → family-revocation sequence against a temporary server, real-data regression checks for the three delete-conflict rules, and a headless-browser (Playwright) check of the gallery page confirming `next/image` optimizes and serves the images with no console errors.
- 2026-10-05 (second round): `next` upgraded 16.2.6 → 16.3.8 (exact pin, matching the project's existing convention for this package; closes a critical RCE advisory in `next/og`'s `ImageResponse` published *after* the 16.3.5 target in the original upgrade plan — `next/og` isn't used anywhere in this codebase, but the patch was a trivial same-minor bump so it was taken anyway rather than relying on "doesn't apply"), `sharp` 0.34.5 → 0.35.4, `eslint-config-next` 16.2.6 → 16.3.8 (kept in lockstep with `next`); `shadcn` moved from `dependencies` to `devDependencies` (it is build-tooling only — `globals.css` imports `shadcn/tailwind.css` at build time — and its own dependency chain, `@modelcontextprotocol/sdk` → `hono`/`express`/etc., accounted for roughly a third of the pre-upgrade advisory count). `SystemTextService.getAllSystemTexts` now wraps its repository call in `unstable_cache` (tag `system-texts`), with `saveSystemText`/`deleteSystemText` calling `revalidateTag` right after writing — the root layout was reading up to 2000 `system_texts` rows from Postgres on every single request; found along the way that this Next version's `revalidateTag` now requires a second `profile` argument (the single-argument form is deprecated). `npm audit --omit=dev`: 0 critical, 0 high, 5 moderate — all three remaining advisories already known (`baseline-browser-mapping`, bundled inside `next` itself as a build-time-only tool, not reachable at runtime; `decode-uri-component`/`stream-json` via `minio`'s old dependency chain, an already-documented accepted risk since the audit's own suggested fix is a `minio` downgrade). `tsc --noEmit` and `next build` clean (same 28 routes); `npm run lint` 420 problems (349 errors, 71 warnings, a small shift from the `eslint-config-next` bump, not a regression introduced this round). Still needed from the owner: a real Google login and a real browser image upload (CP-2's manual-verification step — Google OAuth cannot be exercised by a script).
- 2026-10-05: `CategoryService.saveCategory` now rejects a `parentId` that doesn't exist (it previously checked only for self-reference and cycles, so a nonexistent parent id was silently accepted — found while discussing the missing self-referencing FK constraints on `categories.parent_id`/`comments.reply_id`, which stay open pending a migration the owner hasn't approved yet, `CHANGE-PLAN.md` CP-22); `GET /posts`'s `search` now also matches `description`, not just `title` (same `::text ILIKE` approach, OR'd together — still no GIN/trigram index, still a sequential scan); the public project gallery's icon lookup no longer does `import * as LucideIcons from "lucide-react"` — a small curated set of explicitly named icons, merged into the existing `react-icons/fa` map, covers every currently configured social-link icon, with a generic `Link` fallback for an unrecognized one; `DrizzleDatabase`'s singleton is now cached on `globalThis` instead of a class static field, so `next dev`'s Fast Refresh can no longer spin up extra Postgres connection pools by re-evaluating the module; Google Fonts (Inter, Playfair Display) now load through `next/font/google` instead of a CSS `@import` — self-hosted at build time, same families/weights/subsets (latin + cyrillic) as before, zero runtime requests to Google. `tsc --noEmit` and `next build` re-run clean; verified against the local dev DB (parentId existence check, description-only search match, self-cleaning) and a headless-browser check of a project page (computed `font-family` confirms Inter/Playfair Display apply correctly, 0 requests to `fonts.googleapis.com`/`fonts.gstatic.com`, the 5 configured social icons unchanged, 0 console errors, a side-by-side screenshot shows no visual change).
- 2026-10-06: a route-level `withAdminAuth()` second auth check added to every write route (`CHANGE-PLAN.md` CP-5); `GET /collections/:id/posts` un-double-wrapped (CP-6); `.agents/` retired into `docs/` (CP-34); FK constraints, the Redis-backed rate limiter and a strict nonce-based CSP discussed and declined/deferred (CP-22, CP-27, CP-33).
- 2026-10-12: public list/read endpoints (`categories`, `collections`, `tags`, `colors`, `system-texts`, `posts`) now send `Cache-Control` (`sendSuccess()`'s new `cacheSeconds` argument) instead of hitting Postgres on every request — unconditional 60s for the entity lookups, 30s for `posts` and only for non-admin callers, since an admin's response can contain Draft/Archived posts a shared cache must not leak to the next anonymous caller (CP-23). `tsc --noEmit`/`next build` clean, checked live against a temporary server.
- 2026-10-12 (second round): `POST /media` now takes exactly one file per request (`MediaService.uploadMedia`, not `uploadMultiple`) instead of an array — the admin media page was already the endpoint's only caller and already sent one file per request, so this closes a dormant bug where a batch request failing partway through silently dropped already-saved rows from its response, by removing the multi-file path entirely rather than patching around it; `MAX_FILES_PER_UPLOAD` is gone with it. The admin media page also now keeps a running list of filenames that failed to upload, shown under the drop zone until the next batch starts. On your go-ahead the same day, the page's remaining raw-`fetch` calls (`GET`/`POST`/`DELETE /media`) were also replaced with RTK Query (`uploadMedia`/`deleteMedia` mutations added to `store/api.ts`, `getMedia` finally put to use) — the grid now derives from the cached query and refetches itself via `invalidatesTags`, same pattern as every other admin list, instead of hand-rolled local-state updates (CP-16b). `tsc --noEmit`/`next build` clean; checked live with a headless-browser (Playwright) run against a temporary server with a locally-minted admin cookie — uploading a valid+invalid file pair through the real file input grew the grid by one and listed the invalid file's name, deleting a card through the real `ConfirmModal` shrank it back, no new console errors beyond the expected 409 network log for the intentional bad upload. You then asked to bring the file-count cap back, reframed: the server has nothing left to cap (one file per request), but the UI's own sequential batch can still select far more files than `RATE_LIMITS.upload` (30/minute) allows, which would just start failing with 429s partway through a large selection — so the cap moved client-side as `NEXT_PUBLIC_MAX_FILES_PER_UPLOAD` (optional, defaults to 30, matching the rate limit), checked against `files.length` in `admin/media/page.tsx`'s `handleFiles` before anything uploads; exceeding it shows an error toast and starts nothing, rather than uploading the first N and silently dropping the rest.
- 2026-10-12 (third round): started CP-18 (the code-standard/refactor pass) with its two smallest, lowest-risk items, picked first by your choice. `TagService.deleteTag`'s manual "load every category, drop this tag id, re-save" loop is gone — `categories_to_tags.tag_id` already has `ON DELETE CASCADE` to `tags.id`, confirmed `tagsIds` on a populated category comes only from that join table, so the loop was pure dead weight; `deleteTag` is now one line, `categoryRepo` dropped from `TagService`'s constructor. `StorageService.uploadImage` now computes `orientation` as `'Landscape'`/`'Portrait'` (capitalized) instead of lowercase, matching the type/Zod enum everywhere else expected all along; `MediaService.uploadAndSaveMedia` lost the `as "Portrait" | "Landscape"` cast that had been quietly asserting the old lowercase value into the right-looking type rather than fixing it. Checked every `orientation` reader first: two already normalize with `.toLowerCase()` (unaffected), one (`ProjectCard.tsx`) does an exact-case check that could never match the old value and was silently relying on its own dimension-based fallback instead — it starts actually matching now, same visible result either way. On your go-ahead, also ran a one-time `UPDATE media SET orientation = initcap(orientation)` against the local dev DB, normalizing the 4 existing rows that still held the old lowercase value (`CHANGE-PLAN.md` CP-18) — no production data exists yet, so nothing else needed this.
- 2026-10-12 (fourth round): CP-18's `withErrorHandling(handler)` wrapper. All 36 `catch` blocks across the 9 controllers were confirmed identical (`catch (error: any) { return sendError(error); }`) before touching anything, so a single wrapper (`src/utils/apiResponse.ts`, next to `sendSuccess`/`sendError`) covers every case with nothing behavior-specific lost. Every controller method is now a class-property arrow function — `methodName = withErrorHandling(async (request, id?) => {...});` instead of `async methodName(...) { try {...} catch {...} }` — transparent to every `route.ts` caller. One dead variable (`searchParams` declared but never read in `categoryController.getCategoryById`) was dropped along the way. `npm run lint`: 415 → 378 problems (346 → 310 errors). `tsc --noEmit`/`next build` clean; live-checked a 200 with `Cache-Control` intact, a 404 thrown from inside a handler, a malformed-JSON `ValidationError`, a `NotFoundError` from `commentController`, and that the unrelated route-level `withAdminAuth` 401 still fires before the controller runs.
- Not implemented from the plans: users/profile UI, SEO settings page, dedicated archive view, multi-select category filter, tests/Prettier. See `DEVIATIONS.md`.

---

## 2. Architecture Overview

```
src/app/api/v1/**/route.ts   thin handlers: call one controller method
        ↓
src/controllers/*            parse request, validate with Zod (common/validation/schemas.ts),
                             respond via utils/apiResponse (sendSuccess / sendError)
        ↓
src/services/*               business logic; contracts in services/interfaces.ts
        ↓
src/repositories/drizzle/*   Drizzle queries; contracts in repositories/interfaces.ts;
                             all extend DrizzleBaseRepository (getAll/getById/save/delete/…)
```

- **Composition root:** `src/modules/core/container.ts` builds repositories → services → controllers (manual DI, module-level singletons). A new entity must be registered there; routes import controllers from it.
- **Errors:** throw subclasses of `BaseError` (`src/common/errors/*`, each with `statusCode`, `errorCode`, `serialize()`); controllers catch and return `sendError`. Envelope: `{ data, meta? }` on success, `{ data: {}, error: { code, message, details? } }` on failure.
- **Slug-or-UUID:** most `:id` routes accept either; `utils/idResolver.ts` (`resolveId`, `resolveMultipleIds`) resolves slugs.
- **Pagination:** `getPaginationParams` reads `?page&limit` and caps `limit` at `MAX_PAGE_SIZE = 100`; `GET /posts` defaults to page 1 with 20 items, the lookup lists (categories, tags, colors, collections, media) stay unpaginated without a `limit`. Services fetch `limit + 1` and `services/pagination.ts` builds `meta` (`totalItems` is the current page size, not a total). Every list controller must use the shared helper, not parse `page`/`limit` itself.
- **Config/env:** `src/modules/core/env.ts` validates the 32 required env vars at import and throws if any is missing (`JWT_SECRET` since 2026-09-19, `S3_PUBLIC_URL` since 2026-09-23; `S3_FORCE_PATH_STYLE` and `GOOGLE_CALLBACK_URL` dropped 2026-09-28, unused).
- **Auth boundary:** `src/proxy.ts` (see §6). Rate limiting and locale routing are also handled there.
- **Frontend:** `src/app/[locale]/(public)` public site (client components fetching through RTK Query; server side only for metadata, sitemap, robots); `src/app/admin/*` CMS (client components, shadcn-heavy). Components: `components/ui` (shadcn primitives), `components/shared`, `components/features`.
- **i18n (custom, `src/i18n/index.tsx`):** UI strings come from the `system_texts` table (loaded in the root layout, `t(key)`); entity fields are JSONB `{locale: text}` resolved with `loc(field)` / `utils/localization.ts`. Public locale is in the URL (`/ru`, `/en`); admin locale is in the `admin_locale` cookie.

Detailed rules and history: `docs/guidelines/frontend.md` (still mostly valid; the code wins where it disagrees). `architect.md` and `backend.md` (the old `.agents/rules/` files for TS style and an Express-era backend) were retired 2026-10-06 — their still-relevant content is already folded into this file's Working Agreements and §2/§6/§8 above (CP-34).

---

## 3. Commands

```bash
bash scripts/run.sh dev       # next dev with config/local.env exported (plain `npm run dev` does NOT load it); the script is not executable, so use `bash`
bash scripts/run.sh build     # next build (same env loading)
bash scripts/run.sh start
npm run lint                  # eslint (next core-web-vitals + typescript); currently RED, see §11
docker-compose up -d          # local Postgres :5432, MinIO :9000/:9001, pgweb :8081

# Drizzle (drizzle.config.ts reads process.env.DB_URI and does not load dotenv)
set -a; source config/local.env; set +a
npx drizzle-kit generate      # create SQL migration from src/repositories/drizzle/schema.ts → src/migrations/sql
npx drizzle-kit push          # or apply schema directly (dev/test)
npx tsx src/migrations/seeds/runSystemTextsSeed.ts   # seed system_texts (loads config/local.env itself)

# Tests: scripts exist, but there is NO vitest/playwright config and NO test files yet
scripts/run-test.sh test:db:start    # test Postgres :5433 + drizzle-kit push (config/test.env)
scripts/run-test.sh test:unit        # vitest run
npx vitest run path/to/file.test.ts  # single unit test
scripts/run-test.sh test:api         # playwright --project=api;  test:e2e for --project=e2e
npx playwright test path/to/spec.ts --project=api   # single spec
scripts/run-test.sh test:db:stop
```

Nothing runs migrations at app startup or deploy time. The MinIO bucket is prepared lazily: `ensureBucket()` runs before the first upload of a process (see §8).

---

## 4. Folder Structure (`src/`)

```
app/
  [locale]/(public)/        home (page.tsx), projects/[slug]/{layout,page}.tsx
  admin/                    login, dashboard, projects/[id], categories, collections, tags,
                            colors, media, comments, localizations/[entityType]/[id]
  api/v1/                   auth/*, posts, categories, collections, tags, colors, media, users,
                            system-texts, admin/comments; each folder has route.ts (+ [id])
  layout.tsx sitemap.ts robots.ts error.tsx not-found.tsx globals.css
common/errors, common/validation   BaseError family; Zod schemas
components/{ui,shared,features}
controllers/                one class per entity
i18n/index.tsx              I18nProvider, useTranslation
migrations/sql, migrations/seeds   Drizzle SQL + seed JSON (only system-texts has a runner)
modules/core/{container,env}.ts, modules/logger, modules/storage (StorageService, minioClient)
repositories/{interfaces.ts, drizzle/}   schema.ts, database.ts (singleton), one repo per entity
services/                   one service per entity + interfaces.ts + pagination.ts
store/                      api.ts (RTK Query, 42 endpoints, silent refresh), slices, middleware
types/                      domain types (+ auth.ts)     utils/   auth, jwt, googleOAuth, rateLimit, postVisibility, paginationUtils, slug, uuid, apiResponse, …
proxy.ts                    auth guard + locale routing
```

---

## 5. Database (Drizzle + PostgreSQL)

Schema: `src/repositories/drizzle/schema.ts`. One migration: `src/migrations/sql/0000_tired_human_robot.sql` (13 tables, 17 btree indexes). Localized fields are JSONB `Record<locale,string>`.

| Table | Key columns / notes |
|-------|--------------------|
| `users` | `email` (unique), `name`, `password` (NOT NULL; constant placeholder string for admin; never returned, `UserRepository.populate()` exposes only id/email/name) |
| `token_sessions` | refresh sessions: `id`=JTI, `user_id`→users (cascade), `refresh_token_hash`, `is_used`, `expires_at`, `token_family` |
| `system_texts` | `code` (unique key), `content` JSONB, `area` = `public`/`admin`/`shared` |
| `colors` | `color` hex; `user_id` |
| `media` | `thumbnail_url`, `original_url`, `width`, `height`, `orientation`, `user_id` |
| `collections` | `slug` (unique), `title`, `description`, `main` |
| `categories` | `slug`, `title`, `description`, `order`, `parent_id` (no FK constraint), `color_id`→colors (restrict), `collection_id` |
| `tags` | `slug`, `name` |
| `categories_to_tags` | PK (`category_id`,`tag_id`), cascade |
| `posts` | `slug`, `title`, `description`, `poster_id`→media (restrict), `in_stock`, `status` (`Draft`/`Published`/`Archived`), `collection_id`, `category_id`, `created_at` (used for manual ordering) |
| `posts_to_media` | PK (`post_id`,`media_id`), `order`, `position` JSONB `{x,y,zoom}` |
| `posts_to_tags` | PK (`post_id`,`tag_id`), cascade |
| `comments` | `post_id`→posts (cascade), `name`, `text`, `status` (`Review`/`Approved`/`Rejected`), `reply_id` (no FK constraint) |

Ownership FKs (`user_id`) are `ON DELETE SET NULL`. Repositories re-expose `tagsIds` and `media` arrays to services. The seed JSONs in `migrations/seeds/initial-data` (categories, tags, colors, collections, users, system-texts) have loaders only for system texts.

---

## 6. Authentication & Authorization

- **Login:** `/admin/login` → `POST /api/v1/auth/google/start` builds the Google authorize URL (`response_type=code`, scope `openid email profile`, a random `state`, a PKCE S256 challenge, redirect address `NEXT_PUBLIC_APP_URL + /admin/login` fixed on the server) and stores `state` plus the PKCE verifier in the single-use `oauthState` cookie (HttpOnly, SameSite=Lax, path `/api/v1/auth`, 10 min) → Google → back at `/admin/login?code&state` → `POST /api/v1/auth/google/exchange {code, state}`. The server compares the state with the cookie and deletes it, exchanges the code with Google (with `code_verifier`), verifies the ID token with `jwtVerify` against Google's keys (RS256, issuer, audience = `GOOGLE_CLIENT_ID`, expiry), requires `email_verified`, and allows only emails in `ADMIN_EMAILS` (comma list, case-insensitive). It then finds/creates the `users` row and issues cookies. Helpers: `utils/googleOAuth.ts`.
- **Tokens:** `accessToken` JWT (HS256, 15 min, payload `{userId, role:"admin", email}` since 2026-10-02, cookie path `/`) and `refreshToken` (`<jti>.<random>`, hash stored in `token_sessions`, 7 days, cookie path `/api/v1/auth`). Both HttpOnly, SameSite=Strict, `Secure` in production.
- **Refresh:** `POST /api/v1/auth/refresh` rotates the token; reuse of a used token, or refreshing while the access token has >2 min left (only counted as suspicious if that access token would still pass `verifyAdminToken`, so a pre-2026-10-02 or allowlist-removed token upgrades/fails through the ordinary path instead), revokes the whole `token_family`. Since 2026-10-02 every rotation also re-fetches the user and checks their email against `ADMIN_EMAILS`; if it is no longer allowed, the family is revoked and refresh answers 401 — previously a removed admin's refresh chain kept working up to 7 days even though their access tokens were already rejected. `store/api.ts` performs a silent refresh on 401 and redirects to `/admin/login` on failure.
- **Dev bypass:** `POST /api/v1/auth/dev-login` when `NEXT_PUBLIC_DEV_MODE=true` (build-time flag; must be `false` in production; the route also answers 403 when `NODE_ENV=production`).
- **Guard (`src/proxy.ts`):** `/admin/*` (except `/admin/login`) needs a valid `accessToken` cookie, otherwise redirect to login. `/api/v1/*`: `/auth/*` needs no token (but is rate limited); any `POST/PUT/PATCH/DELETE` needs a valid JWT, except public `POST /api/v1/posts/:id/comments`; every method on `/api/v1/users/**`, `/api/v1/admin/**` and (since 2026-09-28) `/api/v1/media/**` needs a JWT too — media joined the pattern because it backs only the admin media picker and previously leaked images of unpublished posts to anonymous `GET` callers; `/users/**` now only has `GET` methods left (its writes were dead code with no UI consumer, removed 2026-10-01); all other `GET` are unauthenticated at the proxy. Since 2026-10-02 both checks call `verifyAdminToken()` (`utils/jwt.ts`), which verifies signature/expiry, `role === "admin"` **and** that the token's `email` is still in `ADMIN_EMAILS` — previously only signature/role were checked, so removing an admin's email had no effect until their refresh chain expired. Since 2026-10-06 every write `route.ts` also wraps its handler in `withAdminAuth()` (`utils/withAdminAuth.ts`), a second, independent check re-verifying the same token — so a bypass of the proxy no longer leaves writes open (`CHANGE-PLAN.md` CP-5). Controllers themselves stay unaware of authorization (the check lives at the route layer, not in controller methods).
- `utils/auth.ts → getUserId()` and `isAdminRequest()` both call the same `verifyAdminToken()` (no DB lookup beyond confirming the user row exists for `getUserId()`); `isAdminRequest()` decides what a reader may see.
- **Post visibility:** anonymous readers get only `Published` posts. `utils/postVisibility.ts` (`resolveStatusFilter`, `visibleToViewer`) is used by `GET /posts`, `GET /posts/:slugOrId` (404 for unpublished), `GET /collections/:id/posts` and the server-rendered metadata and UUID→slug redirect in `projects/[slug]/layout.tsx`. A valid admin cookie sees every status; `status=all` is the admin dashboard's explicit request for every status (`resolveStatusFilter` returns no filter for it when admin, and 401s for it otherwise, since 2026-09-28) — every other status value still degrades silently to `Published` for a non-admin caller, unchanged. New code that returns posts must go through the same helpers.
- **Rate limiting** (`proxy.ts` + `utils/rateLimit.ts`, `rate-limiter-flexible`, in memory, per client address): `/api/v1/auth/*` 20 per minute, public comment `POST` 5 per 10 minutes, `POST /media` 30 per minute, and (since 2026-10-02) every other authenticated `POST/PUT/PATCH/DELETE` under `/api/v1/` 300 per minute (`RATE_LIMITS.adminWrite`) — deliberately loose, sized only to catch a leaked token or a runaway script, not to throttle normal admin work. Over the limit: 429 `TOO_MANY_REQUESTS` (standard envelope) with `Retry-After`. The address is the last `X-Forwarded-For` entry (assumes Traefik as the only proxy in front; in `next dev` every request shares the key `unknown`). Ordinary GETs are not limited. Single instance only; several instances need Redis or Traefik's middleware — declined 2026-10-06 (CP-27) since more than one instance isn't planned. A new limited route means extending `resolveRateLimitRule` in `proxy.ts`.
- No CSRF token (SameSite=Strict only), no CORS headers (same-origin).

---

## 7. API

- Base path `/api/v1`. Full route list and target contracts: `docs/project-plan/backend.md` and `diagram.jpg` (the code implements the same resources at `/api/v1/<resource>`, uses `PUT` for updates, and has no `/admin/` segment except `/admin/comments/*`; see `DEVIATIONS.md`).
- Public site reads: `GET /posts?search&category&tag&collection&inStock&status&page&limit` (`category` is comma-separated slugs/UUIDs; anonymous callers always get `Published`, `status` matters only with the admin cookie; `limit` is at most 100 and defaults to 20 per page), `GET /posts/:slugOrId` (404 for unpublished unless admin), `/categories`, `/collections`, `/tags`, `/colors`, `/system-texts`, `GET/POST /posts/:id/comments` (GET returns only `Approved`).
- Writes require the admin cookie (see §6); so does every method on `/admin/**` and `/media/**` (anonymous `GET /media` answers 401 since 2026-09-28), plus the remaining `GET` methods on `/users/**` — its write methods (`POST/PUT/DELETE`) were removed 2026-10-01 as unused dead code, so only `GET /users` and `GET /users/:id` exist now. Media upload is `POST /media` as `multipart/form-data` with `files`.
- Client code calls the API through RTK Query endpoints in `src/store/api.ts`; add an endpoint there when adding a route.

---

## 8. File Storage (MinIO / S3)

- Used for post images. `MediaService.uploadMedia` → `StorageService.uploadImage` (`src/modules/storage`): the pre-check on `file.type`/size is a fast filter only; the real check is `sharp(buffer).metadata().format` after decoding — JPEG/PNG only (a mismatched or undecodable file is a `ValidationError`, 400, not a 500), resized to fit 1000×1000 (original) and 320×320 (thumbnail), format preserved. The stored extension and object `Content-Type` come from the decoded format too, not the client's filename/MIME (since 2026-09-28). Since 2026-10-12 `POST /media` takes exactly one file per request (`uploadMedia(file, userId)`, not an array) — the admin media library was already the endpoint's only caller and already sent one file per request, so this just makes the contract match reality; it also removes a dormant bug where a multi-file request that failed partway through silently dropped already-saved rows from its response (`CHANGE-PLAN.md` CP-16b). `MAX_FILES_PER_UPLOAD` (2026-10-02's cap on files-per-request) is gone with it — moot once more than one file per request is structurally impossible.
- **Known gap, not yet fixed (found 2026-10-02):** `next.config.ts` doesn't set `experimental.proxyClientMaxBodySize`, so Next's own 10 MB default silently truncates the body of any request behind `proxy.ts` (nearly every route) before application code runs. Confirmed: a file at/over ~10 MB in one upload request gets cut mid-file and fails with a raw 500 (malformed multipart), not `NEXT_PUBLIC_MAX_FILE_SIZE_MB`'s intended clean 409 — a real risk for files near that size, since multipart framing overhead can push the real body slightly over 10 MB even for a file just under the configured limit. Fix: set that option to `NEXT_PUBLIC_MAX_FILE_SIZE_MB` plus some headroom — a `next.config.ts` change, planned separately (`CHANGE-PLAN.md` CP-16).
- Objects are stored in bucket `S3_BUCKET_NAME` as `<uuid>-<timestamp>-<name>[-thumb].<ext>`; the public URL `${S3_PUBLIC_URL}/${bucket}/${object}` is stored in the `media` row (absolute URLs). `S3_ENDPOINT` is only the address the server connects to (an internal host in Docker or Coolify); `S3_PUBLIC_URL` is what browsers use. Changing it later means a SQL `replace()` on `media` (`CHANGE-PLAN.md` CP-8); `saveMedia` also accepts external URLs.
- `ensureBucket()` (`minioClient.ts`) runs before the first upload of a process: it creates the bucket if missing and sets public read only when the bucket has no policy (an existing policy is kept); a failure is not cached. Deleting a media row also removes its two objects from MinIO (`StorageService.deleteImage()`, best-effort, skips external URLs; since 2026-09-28).
- A media row cannot be deleted while it is a post poster or gallery item (409 `MEDIA_IN_USE`).
- No presigned URLs; reads are public, writes go through the API only.
- There is no storage interface yet (planned Adapter/Strategy); `StorageService` talks to MinIO directly.

---

## 9. Docker & Infrastructure

`docker-compose.yml` (local dev only): `postgres` (16-alpine, db `portfolio`, :5432, data in `./.docker/db-data`), `minio` (pinned release, :9000 API / :9001 console, data in `./.docker/minio-data`), `pgweb` (:8081). Fixed subnet `10.10.10.0/24`, `restart: always`, no healthchecks, dev credentials hardcoded. `docker-compose.test.yml`: Postgres 15 on :5433 for tests. **No app service, no Dockerfile, no CI.**

**Environment variable names** (values live in `config/local.env`, git-ignored; `config/test.env` holds mock values; all 32 listed are required by `env.ts`, including `JWT_SECRET` since 2026-09-19 and `S3_PUBLIC_URL` since 2026-09-23; `S3_FORCE_PATH_STYLE` and `GOOGLE_CALLBACK_URL` were required-but-unused and dropped from the list 2026-09-28 (the config files may still carry the lines, which is harmless); `config/test.env` has `S3_PUBLIC_URL` but still lacks `JWT_SECRET`, CP-4):

```
DB_URI
S3_ENDPOINT (server → MinIO)  S3_PUBLIC_URL (browser → images)  S3_ACCESS_KEY  S3_SECRET_KEY  S3_BUCKET_NAME
GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET  ADMIN_EMAILS
JWT_SECRET
NEXT_PUBLIC_APP_URL (also the base of the Google redirect address)  NEXT_PUBLIC_DEFAULT_LOCALE  NEXT_PUBLIC_SUPPORTED_LOCALES
NEXT_PUBLIC_MAX_FILE_SIZE_MB  NEXT_PUBLIC_DEV_MODE  NEXT_PUBLIC_SOCIAL_LINKS (JSON array)
SITE_{TITLE,TEMPLATE,DESCRIPTION,KEYWORDS,NAME,FOOTER,PROJECT_NOT_FOUND,PROJECT_DEFAULT}_{RU,EN}
```

`NEXT_PUBLIC_*` values are inlined at build time. `MAX_FILES_PER_UPLOAD` (an optional variable outside this list, added 2026-10-02 to cap files per upload *request*) was removed 2026-10-12 along with the multi-file upload path it capped — `POST /media` now takes exactly one file per request, so there is no longer anything for the server to cap. The same day it came back in a different shape as `NEXT_PUBLIC_MAX_FILES_PER_UPLOAD` (optional, defaults to 30 if unset — not in this required list) — this one caps how many files the admin media page's own sequential loop will start in one *selection*, a client-only concern now that the server only ever sees one file per request; it defaults to matching `RATE_LIMITS.upload` (30/minute, `src/utils/rateLimit.ts`), so a larger selection doesn't just start failing with 429s partway through.

---

## 10. Current Status

Working: Google login + token rotation, public catalog with search / category / in-stock / favorites (localStorage) filters and infinite scroll, project page (masonry gallery, contact links, moderated comments), admin CRUD for all entities, drag-and-drop ordering (categories, media in a post), crop modal, media library with delete protection, localization editor (DB-driven texts), slug URLs with UUID→slug redirect, OpenGraph/hreflang metadata, sitemap.xml, robots.txt.

In progress / missing: see `DEVIATIONS.md` (`[gap]` items). No automated tests exist.

---

## 11. Known Issues & Security Concerns

Full detail with file references: `PRODUCTION-READINESS.md`. Summary:

| Problem | Status | Priority |
|---------|--------|----------|
| Public `GET /users` and `GET /admin/comments` (proxy guarded only mutating methods): now JWT-gated for every method; `UserRepository` never returns `password` (it was a constant placeholder) | Fixed 2026-09-19, verify by hand (CP-4) | – |
| `POST/PUT/DELETE /api/v1/users` had no role model (any valid JWT could create/edit/delete a user row) and zero consumers in the admin UI: removed entirely 2026-10-01, only `GET` remains | Fixed 2026-10-01 | – |
| Draft/Archived posts readable anonymously (list, by slug, collection posts, page metadata): anonymous callers now get only `Published` | Fixed 2026-09-19, verify by hand (CP-4) | – |
| HTTP 500 returned raw `error.message` (Drizzle errors carry the SQL and parameters): now a generic message, details in the log | Fixed 2026-09-19 | – |
| `JWT_SECRET` not in the required-env list; `dev-login` guarded only by a build-time flag: `JWT_SECRET` is required now and `dev-login` refuses `NODE_ENV=production` (`NEXT_PUBLIC_DEV_MODE` must still be `false` in the production build) | Fixed 2026-09-19 | – |
| `proxy.ts` was the only gate for writes; controllers did not re-check (only the media upload did) | **Fixed 2026-10-06**: every write `route.ts` wraps its handler in `withAdminAuth()`, a second, independent token check (CP-5) | – |
| Invalid UUIDs / malformed JSON end in 500 (generic text) | Fixed 2026-10-02 (second round): `parseJsonBody()` + an `isUUID` guard on every repository's `getById`/`getByIds`/`delete` | – |
| Admin dashboard silently listed only published posts after the 15-minute token expires: it now sends `status=all` and `resolveStatusFilter` answers 401 for it without a valid admin token | Fixed 2026-09-28 | – |
| Public `GET /media` (list and by id) returned every file with no auth, including images of unpublished posts: now JWT-gated like `/users/**` and `/admin/**` (B12; its only consumer is the admin media picker) | Fixed 2026-09-28 | – |
| No security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS): now a baseline set in `next.config.ts`'s `headers()` (the CSP keeps `'unsafe-inline'` for script/style — App Router RSC streaming and framer-motion inline styles need it — so it is not a strict, nonce-based CSP; no HSTS yet, no HTTPS locally) | Fixed 2026-09-28 | – |
| `CommentService.replyToComment` threw a plain `Error` for a missing parent comment (surfaced as 500): now throws `NotFoundError` (404) | Fixed 2026-09-28 | – |
| `CommentService.createComment` didn't check `postId` existed; a bogus id hit the real `comments.post_id` FK and surfaced as a raw 500: now checked up front, `NotFoundError` (404). `replyId` still has no check — and no FK constraint at all, see below | Fixed 2026-10-01 | – |
| `token_sessions` rows were never purged (grows forever) | Fixed 2026-10-01: `TokenRepository.deleteExpired()`, called on every login/refresh, removes only rows past `expiresAt` (a still-unexpired `isUsed` row is kept — reuse detection needs it) | – |
| `search` didn't escape `%`/`_` in `ILIKE`: a literal wildcard character in a search term matched like a SQL wildcard instead of literally | Fixed 2026-10-01 | – |
| `createComment` didn't check `replyId` existed; unlike `postId` there is no FK at all on `comments.reply_id`, so a bad value was silently stored instead of erroring | Fixed 2026-10-02 | – |
| `proxy.ts`/`isAdminRequest()`/`getUserId()` trusted any validly-signed token forever, even for an email later removed from `ADMIN_EMAILS` (up to 7 days via the refresh chain): access tokens now carry `email`, `verifyAdminToken()` re-checks it on every request and every refresh rotation (family revoked if no longer allowed) | Fixed 2026-10-02 | – |
| Admin-only writes other than uploads had no rate limit beyond the JWT check | Fixed 2026-10-02: a loose 300/minute `adminWrite` limit, sized so normal 1-2 person admin work is never throttled | – |
| `MediaService.uploadMultiple` had no cap on files per request | Fixed 2026-10-02 with `MAX_FILES_PER_UPLOAD`; **superseded 2026-10-12**: multi-file requests removed entirely (`uploadMedia` takes one file); the cap moved to the client as `NEXT_PUBLIC_MAX_FILES_PER_UPLOAD`, guarding the admin page's own selection against `RATE_LIMITS.upload` instead of guarding a server request that no longer exists | – |
| `seeds/initial-data/users.json` committed a password-shaped placeholder, unused by any loader | Fixed 2026-10-02: file deleted | – |
| Next's `experimental.proxyClientMaxBodySize` defaults to 10 MB for every request behind `proxy.ts`; a file upload at/over that size is silently truncated and fails with a raw 500 instead of a clean "file too large" (confirmed with a 12 MB file and with two 8.7 MB files in one request) | **Declined 2026-10-06**: the upload UI sends one file per request, so no request should need to exceed 10 MB in normal use (CP-16) | – |
| Admin media library page (`admin/media/page.tsx`) called the API with raw `fetch`, bypassing RTK Query: no silent token refresh past 15 min, no cache invalidation for the media picker | **Fixed 2026-10-12**: failed filenames now listed under the drop zone; the page now uses `uploadMedia`/`deleteMedia` RTK Query mutations and the existing `getMedia` query instead of raw `fetch` and local state (`CHANGE-PLAN.md` CP-16b) | – |
| No rate limiting (auth, upload, public comments) and `limit` uncapped: now per-address limits in `proxy.ts` (in memory, single instance) and `limit` ≤ 100 | Fixed 2026-09-23 | – |
| Rate limiter limits: ordinary public GETs are not limited, counters are per process, the address is the last `X-Forwarded-For` entry (Traefik only) | Open, revisit at deploy | LOW |
| `next@16.2.6`: critical advisories (the Middleware/Proxy bypass GHSA-6gpp-xcg3-4w24 needs Turbopack and a single `config.i18n.locales` entry, so it most likely does not apply here, CP-1); `sharp@0.34.5` high; `shadcn` in `dependencies` instead of `devDependencies` | **Fixed 2026-10-05**: `next` → 16.3.8 (a critical RCE in `next/og` published after the original 16.3.5 target made the extra patch bump worth taking even though `next/og` isn't used here), `sharp` → 0.35.4, `shadcn` moved to `devDependencies`. `npm audit --omit=dev`: 0 critical, 0 high, 5 moderate (all already-known/accepted, see §1) | – |
| OAuth: no `state`/PKCE; ID token not verified for `aud`/`email_verified`: now `state` + PKCE and a verified ID token (issuer, audience, expiry, `email_verified`) | Fixed 2026-09-23, login checked by the owner | – |
| Media URLs built from `S3_ENDPOINT` (internal address) and the bucket never created: now the required `S3_PUBLIC_URL` and `ensureBucket()` | Fixed 2026-09-23 | – |
| Deleting a media row left its files in the bucket; `S3_FORCE_PATH_STYLE` and `GOOGLE_CALLBACK_URL` were required but unused: media deletion now purges both bucket objects, and both env vars were dropped from `requiredEnvVars` | Fixed 2026-09-28 | – |
| `POST /users` could not create a new user (`users.password` NOT NULL, `UserService.saveUser` never set it): now defaults to the same placeholder the Google login route uses | Fixed 2026-09-28 | – |
| Infinite scroll sent one extra request for an empty page after the last one (stale `hasMore` state): now derived at render from `meta.nextPage` on the public page, dashboard, tags and comments | Fixed 2026-09-28 | – |
| "Premature refresh" heuristic can log the admin out | Open | MEDIUM |
| Services bypass repositories (`CategoryService.deleteCategory`, `MediaService.deleteMedia`) | Fixed 2026-10-02 (second round): both call new repository count methods instead of raw Drizzle queries | – |
| Token-issuing code copied in three auth routes | Fixed 2026-10-02 (second round): shared `issueSession()` (`utils/authSession.ts`); other auth logic (OAuth validation, theft-detection heuristics, allowlist checks) is route-specific, not duplicated, and stays in each route | – |
| Self-referencing FKs missing at the DB level (`categories.parent_id`, `comments.reply_id`) — no `ON DELETE`/existence guarantee from Postgres itself, only app-level checks | **Narrowed 2026-10-05**: `saveCategory` used to validate `parentId` only for self-reference and cycles, never that it exists — now checked (no migration). The real DB-level FK constraint was declined 2026-10-06 — app-level checks are considered sufficient (CP-22) | – |
| Search: `title::text ILIKE` (no GIN/trigram), title only | **Partly fixed 2026-10-05**: `search` now also matches `description` (same pattern, OR'd with `title`); still no GIN/trigram index, still a sequential scan | MEDIUM |
| `/sitemap.xml` was prerendered at build from the DB (stale; empty of posts in a Docker build): now built on each request (`force-dynamic`) | Fixed 2026-09-23 | – |
| Media pipeline differs from plan (no JPG conversion, 1000/320 px) | Open | MEDIUM |
| Upload MIME/extension was trusted from the client instead of the decoded file: now validated against the real `sharp`-decoded format (JPEG/PNG only), extension and object `Content-Type` derived from it, and an unsupported/undecodable file is a 400 instead of an uncaught 500 | Fixed 2026-09-28 | – |
| `meta.totalItems` = page size; `/collections/:id/posts` double-wrapped | Open | LOW |
| Lint red: 378 problems, 310 errors as of 2026-10-12 (287 `no-explicit-any`, 51 `no-unused-vars`, 18 `set-state-in-effect`, 8 `exhaustive-deps`, 3 `no-empty-object-type`, 2 misc) — down from 415/346 the same day after CP-18's `withErrorHandling` removed 36 identical `catch (error: any)` blocks; the bulk of this (the `any` sweep, `set-state-in-effect`) is still open, not a quick fix; 34 of 40 `console.*` still bypass the logger (6 fixed 2026-10-02 — the rest are in client components, where winston can't run, a distinct gap, CP-18); 6 of 7 raw `<img>` remain (the public project gallery now uses `next/image`, fixed 2026-10-02) | Open | LOW |
| `import * as LucideIcons from "lucide-react"` defeated tree-shaking; Google Fonts loaded via a blocking CSS `@import` | Fixed 2026-10-05: explicit named icon imports (+ a small curated extra set) replace the `import *`/dynamic-lookup fallback; `Inter`/`Playfair Display` now load via `next/font/google` (self-hosted, no runtime Google request) | – |
| `DrizzleDatabase` cached its singleton in a class static field, which `next dev`'s Fast Refresh could re-create (extra connection pool) on module re-evaluation | Fixed 2026-10-05: singleton cached on `globalThis` instead | – |
| Root layout read up to 2000 `system_texts` rows from Postgres on every single request | Fixed 2026-10-05: `SystemTextService.getAllSystemTexts` wrapped in `unstable_cache` (tag `system-texts`), `saveSystemText`/`deleteSystemText` call `revalidateTag` to invalidate on write | – |
| Fixed since the older audits: client-side admin guard, `getUserId` payload mismatch, default JWT secret, no indexes, list over-fetch, category cycles, slug URLs | Fixed | – |

`audit_results.md`, `report.md`, `tags_review.md` (untracked, root) are earlier working notes; `AUDIT-SUMMARY.md` records which of their findings still hold.

---

## 12. Production Readiness (VPS + Coolify)

Checklist and open questions: `PRODUCTION-READINESS.md`. Headlines: close the §11 HIGH items (the Next/sharp upgrade); write the Dockerfile (chosen route) with a health endpoint and `output: "standalone"` (the sitemap is already dynamic and the build needs no database); set `S3_PUBLIC_URL` to the public MinIO address once it is known (stored in DB, `CHANGE-PLAN.md` CP-8) and register `https://<domain>/admin/login` in the Google console with `NEXT_PUBLIC_APP_URL` set to that origin; add a migration step to deploy; SSL via Coolify (Let's Encrypt); automated backups for Postgres and the bucket; keep `NEXT_PUBLIC_DEV_MODE=false` in build variables; never reuse compose dev credentials.

---

## 13. Quick Links

- Guidelines: `docs/guidelines/frontend.md`, `design.md` (visual language: no dark mode, 12px cards, pill controls, Inter + Playfair Display) — moved from `.agents/rules/` 2026-10-06 (CP-34); layering/TS/style rules (the old `architect.md`) and the stale Express-era `backend.md`/`workspace.md`/`system_rules.md`/`quota-rules.md` were retired, not moved, since they were already superseded by this file or by a different AI tool's process docs
- Review workflow: ported into `/portfolio-code-review` (the old `.agents/workflows/review.md` is retired)
- Plans and references: `docs/project-plan/{general,backend,frontend,colors,theme_design}.md`, `design.jpg`, `diagram.jpg` (REST + DB schema), `example-ui/`
- Generated docs: `DEVIATIONS.md`, `PRODUCTION-READINESS.md`, `SKILL-CANDIDATES.md`, `AUDIT-SUMMARY.md`
- Project skills (`.claude/skills/portfolio-*/SKILL.md`, invoked as `/portfolio-<name>`): `code-review`, `architecture-check`, `security-audit`, `backend-standards`, `frontend-standards`, `deployment-validator`, `api-exposure-check`, `db-performance`, `requirements-check`, `new-entity`, `i18n-sync`, `db-migration`, `design-check`, `dependency-audit`, `docs-sync`. Details: `SKILL-CANDIDATES.md`.
- Open steps and reminders: `CHANGE-PLAN.md`

---

## 14. Open Steps (imported from `CHANGE-PLAN.md`)

@CHANGE-PLAN.md

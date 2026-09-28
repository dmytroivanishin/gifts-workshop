# Plan vs. Code Deviations

Source of truth is the **current code in `src/`**. Plans in `.agents/project-plan/` are treated as intent, not as spec. Each item is tagged:

- **[intentional]** – the code chose a different but valid approach; nothing to fix, the plan is just outdated.
- **[quality]** – the code diverges from the project's own design rules (`.agents/rules/*`, layered architecture, contracts) and is a candidate for cleanup.
- **[gap]** – planned, not implemented.
- **[added]** – exists in code, absent from the plans.

Stack choices (Next.js route handlers instead of Express, Drizzle + Postgres, Redux Toolkit) and the `/api/v1` prefix are **not** deviations; see `CLAUDE.md`.

Verification scope: all of `src/app/api`, `proxy.ts`, controllers/services/repositories (read in full or in the relevant parts), schema + migration, storage, store, i18n, public pages, admin layout/login. Admin CRUD pages and UI components were skimmed structurally, not line by line.

---

## Backend

### Architecture
- **[intentional]** Planned Express + a central error middleware + `authMiddleware` → Next.js route handlers, `src/proxy.ts` (the Next 16 name for middleware) for auth, and a `try/catch → sendError()` block repeated in every controller method.
- **[quality]** Planned "all business logic in Services". Actual:
  - `src/app/api/v1/auth/**` (Google exchange, refresh rotation, theft detection, dev-login, logout) holds full business logic and talks to repositories directly. There is no `AuthService`, and the same token-issuing block is copy-pasted three times.
  - `CategoryService` (`deleteCategory`) and `MediaService` (`deleteMedia`) import `drizzleDatabase` + schema tables and run queries themselves, bypassing the repository interfaces the plan requires for DB swappability.
  - `collections/[id]/posts/route.ts` and `posts/[id]/comments/route.ts` contain logic (query rewriting, response shaping) instead of delegating.
- **[quality]** Storage: plan requires an Adapter/Strategy interface so the backend can swap Local/S3/Cloudinary. Actual: concrete `StorageService` using the MinIO client directly, no interface. `MediaService` imports the singleton.
- **[fixed 2026-09-23]** `initializeBucket()` was imported in `container.ts` but never called, so the bucket had to be created by hand. Now `ensureBucket()` (`minioClient.ts`) runs before the first upload of a process: it creates the bucket if missing and sets public read only when the bucket has no policy. `initializeBucket()` is removed.
- **[intentional]** DI is manual in `src/modules/core/container.ts` (repositories → services → controllers). Repositories are module-level singletons.

### Auth
- **[intentional]** Plan: access token in header. Actual: both tokens in HttpOnly cookies (`accessToken` path `/`, `refreshToken` path `/api/v1/auth`, SameSite=Strict, `Secure` only when `NODE_ENV=production`). RTK Query `baseQueryWithReauth` does the silent refresh on 401.
- **[intentional]** "Single hardcoded admin email" → `ADMIN_EMAILS` (comma list). The allowlist is checked only at Google login; `proxy.ts` verifies JWT signature/expiry, not email or role. The user row is auto-created with a placeholder password (`"admin_hashed_password"`).
- **[intentional]** Refresh tokens: session table + hash + `isUsed` + `tokenFamily` rotation and reuse detection, as planned.
- **[added]** "Premature refresh" heuristic: refreshing while the access token has >2 min left revokes the whole family. Not in the plan, and it can log out a legitimate admin (multi-tab, retries).
- **[quality]** `GOOGLE_CALLBACK_URL` is a required env var but is unused (its local value is a placeholder). Since 2026-09-23 the redirect address is fixed on the server as `NEXT_PUBLIC_APP_URL` + `/admin/login` and the client no longer sends it.
- **[added]** `POST /auth/dev-login` bypass, gated by `NEXT_PUBLIC_DEV_MODE` and, since 2026-09-19, refused when `NODE_ENV=production`.
- **[added]** OAuth code flow with `state` and PKCE (S256), since 2026-09-23: `POST /auth/google/start` builds the Google URL and keeps both values in a single-use HttpOnly cookie (`oauthState`, SameSite=Lax, path `/api/v1/auth`); `google/exchange` checks them, sends `code_verifier`, and verifies the ID token with `jwtVerify` against Google's keys (RS256, issuer, audience = `GOOGLE_CLIENT_ID`, expiry) and requires `email_verified`. The old `GET /auth/config` (exposed the client id) was removed. Code: `utils/googleOAuth.ts`.
- **[quality]** Auth endpoints differ from the plan (`sign-in`/`sign-out`/`refresh` → `google/start` + `google/exchange`/`logout`/`refresh`). That is fine; see the routing note below.

### Routing / API surface
The endpoint table in `backend.md` stays valid as a target. Differences in the code:
- **[intentional]** Resources live at `/api/v1/<resource>` (no `/admin/` segment); protection is by HTTP method in `proxy.ts` (all `POST/PUT/PATCH/DELETE` need a valid JWT, except public `POST /posts/:id/comments`; since 2026-09-19 every method on `/api/v1/users/**` and `/api/v1/admin/**` needs one too). Only admin comment moderation is under `/api/v1/admin/comments`.
- **[intentional]** Updates use `PUT` (not `PATCH`), except `system-texts/:id` and `admin/comments/:id/status`.
- **[intentional]** `GET /collections/:collection_slug/posts/:post_slug` is not implemented; posts are fetched via `GET /posts/:slugOrId`, and `resolveId()` lets most routes accept either UUID or slug.
- **[intentional]** Filters: `?category=` takes comma-separated slugs/UUIDs, `?inStock=true` (plan: `?in_stock`), plus `?collection=` and `?status=`. `?search=` matches **title only** (plan: title or description).
- **[gap]** `/admin/slugs` and `/admin/localization` from `diagram.jpg`: no Slug or Localization tables/endpoints. Localization is served by `/system-texts` (UI strings) and by JSONB fields on entities.
- **[added]** `PUT /categories/reorder`, public comment endpoints, `/admin/comments/*`, `/system-texts/*`.
- **[fixed 2026-09-28]** Access was decided by HTTP method in `proxy.ts`, not by resource, so every `GET` outside `/users/**` and `/admin/**` was public — including `GET /media`, which listed every file, also images of unpublished posts. Fixed 2026-09-19: `/api/v1/users/**` and `/api/v1/admin/**` need a JWT for every method, `UserRepository` no longer returns `password`, and anonymous readers get only `Published` posts (`GET /posts`, `GET /posts/:slugOrId`, `GET /collections/:id/posts` and the project page metadata). Fixed 2026-09-28: `/api/v1/media/**` joined the same pattern in `proxy.ts` (B12); its only consumer in the codebase is the admin media picker. See `PRODUCTION-READINESS.md` → "Fixed in code".

### Response and error contracts
- **[intentional]** `{data, meta}` / `{data:{}, error:{code,message,details}}` and the `BaseError` hierarchy (`serialize()`, `errorCode`, `statusCode`) match the plan.
- **[quality]** `sendError()` used to return the **raw `error.message`** for non-`BaseError` failures (Drizzle messages include the SQL and parameters). Fixed 2026-09-19: the response is the generic `InternalServerError`, details go to the log only. Invalid UUIDs and malformed JSON still end in 500 instead of 4xx.
- **[quality]** `meta.totalItems` is the size of the current page (`services/pagination.ts`), not the total, and there is no total-count query. Plan contract implies the real total.
- **[quality]** `GET /collections/:id/posts` double-wraps (`data: {data, meta}`) and reports `totalItems: undefined`. `/auth/dev-login` returns `{error: "string"}` outside the contract.
- **[quality]** 40 `console.*` calls bypass the winston logger the plan mandates (`refresh`, `tagService`, `sitemap`, …); the Google login routes use the logger since 2026-09-23.
- **[fixed 2026-09-28]** `CommentService.replyToComment` threw a plain `Error("Parent comment not found")` for a missing parent (surfaced as a generic 500); it now throws `NotFoundError` (404).

### Media
- **[quality]** Plan: convert everything to JPG; thumbnail 300×300, original 1200×1200 fitted. Actual: format preserved (JPEG/PNG only), original max 1000×1000, thumbnail max 320×320 (`fit: inside`). The WebP branch in `StorageService` is unreachable because uploads allow only JPEG/PNG.
- **[quality]** MIME check uses the client-supplied `file.type`. `sharp` re-encoding is the only real validation (bad files surface as 500). Stored `orientation` is lowercase (`"landscape"`), while the type/Zod enum is `"Portrait" | "Landscape"`.
- **[fixed 2026-09-23]** Public URLs were built from `S3_ENDPOINT` (the address the server connects to, an internal host in Docker) and stored absolute in the DB. They now come from the required `S3_PUBLIC_URL`: `${S3_PUBLIC_URL}/${bucket}/${object}`. They are still stored absolute, so changing that variable later needs a SQL `replace()` on `media`. `MediaService.deleteMedia` still leaves the two objects in the bucket, and `S3_FORCE_PATH_STYLE` is required but unused (both in `CHANGE-PLAN.md` CP-6).
- **[intentional]** Integrity check on delete (blocked when used as poster or gallery item) is implemented as planned.

### Data consistency on delete
- **[intentional]** Plan: background task to strip tag/category ids from posts. Actual: relational join tables with `ON DELETE CASCADE` (`posts_to_tags`, `categories_to_tags`, `posts_to_media`), plus service-level guards: a category with children or posts → 409; a media item in use → 409. `TagService.deleteTag` additionally rewrites categories (redundant with the cascade).

---

## Database & Migrations

- **[intentional]** Plan: `Post.media`, `Post.tagIds`, `Category.tagsIds` as embedded arrays (NoSQL style). Actual: normalized join tables `posts_to_media` (`order`, `position` JSONB), `posts_to_tags`, `categories_to_tags`. The repositories re-expose `tagsIds` / `media` arrays to the services, so the domain types still match the plan.
- **[intentional]** Localized fields (`title`, `description`, `name`) are JSONB `Record<locale,string>`, as planned.
- **[gap]** `Language` table: not present. Active locales come from `NEXT_PUBLIC_SUPPORTED_LOCALES` (`ILanguageRepository` in `repositories/interfaces.ts` has no implementation).
- **[intentional]** `SystemText`: plan `id` = key; actual `id` UUID + unique `code` = key, `area` in `public|admin|shared`. Seed has 243 rows (174 admin / 13 public / 56 shared).
- **[intentional]** `TokenSession.expiresAt`: Unix number in the plan → `timestamp` column.
- **[added]** `posts.created_at` (used for manual ordering via date override), 17 btree indexes on FKs/status. The old audit claim "no indexes" is obsolete.
- **[quality]** Self-referencing links are **not** real FKs: `categories.parent_id` and `comments.reply_id` have no constraint in schema or migration. Cycle protection lives only in `CategoryService.saveCategory`, and `CommentRepository.delete` removes replies manually.
- **[quality]** No GIN/trigram index. Search runs `title::text ILIKE '%…%'` (sequential scan, `%`/`_` not escaped).
- **[quality]** `users.password` is `NOT NULL` but `UserService.saveUser` never sets it, so `POST /users` for a new user cannot succeed. Admin rows are created with a placeholder string, not a hash. `seeds/initial-data/users.json` also carries a committed password value.
- **[intentional]** One migration file (`0000_tired_human_robot.sql`, 13 tables, journal has one entry). Nothing calls `migrate()` at startup and there is no `db:migrate` script; `test:db:start` uses `drizzle-kit push`.
- **[quality]** Seeds: only `system-texts.json` has a runner (`runSystemTextsSeed.ts`, not wired into `package.json`). `categories`, `categories_to_tags`, `collections`, `colors`, `tags`, `users` JSON files have no loader in the repo. `pull-system-texts.js` writes to a stale path (`src/migrations/initial-data`, real: `src/migrations/seeds/initial-data`).

---

## Frontend (Public)

- **[intentional]** Stack matches (App Router, Tailwind 4, shadcn `radix-nova`, RTK + RTK Query, Framer Motion).
- **[intentional]** Home page: search, category filter, in-stock filter, favorites filter (added, visible in `design.jpg`), infinite scroll via IntersectionObserver + RTK Query `merge` (fixes the old "local state vs RTK" issue on this page; the admin dashboard still merges in local state).
- **[fixed 2026-09-28]** `hasMore` for infinite scroll was kept in `useState`, synced by a separate `useEffect`; for a short window after the last page arrived the loader stayed mounted and observed, sending one more request for an empty page. Now derived at render from `response.meta.nextPage != null` on the public page, admin dashboard, tags and comments (`admin/localizations/page.tsx` already did this).
- **[gap]** Multi-select category filter: only a single `?category=` selection (a parent expands to its children).
- **[intentional]** Category navigation uses `<Link href>` (old audit claim about `<button>` is obsolete). Likes persist in `localStorage`. Project page: CSS-columns masonry, contact icons from `NEXT_PUBLIC_SOCIAL_LINKS`, fullscreen gallery.
- **[added]** Public comments with moderation (`CommentSection`).
- **[quality]** Public pages are client components fetching via RTK Query; only metadata, sitemap and robots are server-rendered. Project not-found is a client-side message (HTTP 200, no `notFound()`); since 2026-09-19 unpublished posts are no longer served to anonymous readers (the API answers 404).
- **[quality]** `app/layout.tsx` calls `headers()` and loads up to 2000 `system_texts` from the DB on **every** request, which makes every route dynamic. It also reads `SITE_TITLE`, `SITE_TEMPLATE`, `SITE_DESCRIPTION`, `SITE_NAME` (without a locale suffix), which are not in the env whitelist, so the hardcoded fallbacks always apply.
- **[quality]** Rules say `next/image` and `next/font`. Actual: 7 raw `<img>` (incl. the public project gallery), fonts pulled with a CSS `@import` from Google Fonts. `next.config.ts` is empty (no `images.remotePatterns`, headers, or `output`).
- **[quality]** `frontend.md` says default exports, one component per file; shared/feature components use named exports. RTK Query lives in one 442-line `src/store/api.ts`.

## Frontend (Admin)

- **[intentional]** Auth guard is server-side (`proxy.ts` JWT check). The old localStorage guard is gone; the layout only deletes the legacy key.
- **[intentional]** Implemented: dashboard/post list, post editor (status, cover, crop modal, drag-drop reorder, date override, tag combobox), categories tree with drag-drop, collections, tags, colors, media library, comments moderation, localization editor.
- **[gap]** Separate Archive view with restore (only a status badge/filter; restore = edit status). Profile editing. SEO settings page (slugs are auto-generated from titles). Admin UI for `/users` (API only).

## Design & UI

- **[intentional]** Tokens from `colors.md` / `theme_design.md` are in `globals.css` (`--radius: 0.75rem`, category pastel pairs, `.admin-area` theme). Inter + Playfair Display. No dark mode; `dark:` variants only exist inside shadcn primitives, and `next-themes` is used only by `sonner.tsx`.
- **[intentional]** `backdrop-blur` in 8 files, Framer Motion in 4. Exact hover values from `design.md` were not audited.
- **[quality]** Leftovers: `public/{next,vercel,file,globe,window}.svg`, `public/images/old.*.png`.

## Testing & Tooling

- **[gap]** Plan: Vitest (unit/component/coverage), Playwright (E2E), Prettier. Actual: scripts, dependencies and `docker-compose.test.yml` + `config/test.env` exist, but there is **no** `vitest.config`, `playwright.config`, or test file, and no Prettier config.
- **[quality]** Against the "zero `any`" rule: 318 ESLint `no-explicit-any` errors (about 280 source lines). `npm run lint` fails overall with 418 problems (345 errors, 73 warnings; also 19 `set-state-in-effect`, 3 `no-require-imports`, 3 `no-empty-object-type`), counted on 2026-09-23. `strict: true` is on, `tsc --noEmit` and `next build` pass. No `eslint-disable` / `@ts-ignore` anywhere.

## Infrastructure

- **[intentional]** `docker-compose.yml`: postgres 16, minio (pinned release), pgweb; fixed subnet; bind mounts under `.docker/` (git-ignored).
- **[gap]** No `app` service, no `Dockerfile`, no `.dockerignore`, no CI, no healthchecks, no `output: "standalone"`. Nothing in the repo describes the Coolify deployment. Decision (2026-09-19): deploy from a Dockerfile; Coolify is not set up yet and nothing is deployed.
- **[fixed 2026-09-23]** `/sitemap.xml` was prerendered at build time from the DB (static in the build output), so it went stale and would be nearly empty in a Docker build. It now exports `dynamic = "force-dynamic"` and is built on each request; `next build` passes without a reachable database.
- **[added]** Rate limiting (2026-09-23), not in the plan: `proxy.ts` + `utils/rateLimit.ts` (`rate-limiter-flexible`, in memory, per client address): `/api/v1/auth/*` 20 per minute, public comment POST 5 per 10 minutes, `POST /media` 30 per minute; 429 `TOO_MANY_REQUESTS` with `Retry-After`. `limit` is capped at 100 and `GET /posts` defaults to 20 per page. Single instance only; ordinary GETs are not limited.
- **[added]** Security headers (2026-09-28), not in the plan: `next.config.ts`'s `headers()` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` and a baseline `Content-Security-Policy` (`script-src`/`style-src` keep `'unsafe-inline'` for App Router RSC streaming and framer-motion inline styles, so it is not nonce-based). No HSTS yet (no local HTTPS).
- **[quality]** `next@16.2.6` / `sharp@0.34.5` carry `npm audit` advisories (1 critical); the `shadcn` CLI is in `dependencies`. See `PRODUCTION-READINESS.md`.
- **[quality]** Dev credentials are hardcoded in compose, and pgweb (8081) and the MinIO console (9001) are exposed. These are fine for local use only.

## Documentation drift (`.agents/`, root)

- `rules/backend.md`, `rules/system_rules.md`: still say Express; reference non-existent `.agents/plans/` and `.agents/summaries/`.
- `rules/design.md`, `workflows/review.md`: reference `theme_colors.md` / `.agents/theme_colors.md`, which does not exist (real: `project-plan/colors.md` + `theme_design.md`).
- `rules/quota-rules.md`: an AI token-economy note with an obsolete 3-step plan; not architecture.
- `project-plan/backend.md`: `Post.media` as embedded JSONB, `Language` model, `PATCH` verbs; superseded by the code above.
- `README.md`: unmodified create-next-app text. `report.md` / `audit_results.md`: partly obsolete, see the status table in `AUDIT-SUMMARY.md`.
- `scratch_findKeys.mjs` (tracked): a one-off i18n key scanner. `tags_review.md`: a Russian tag brainstorm feeding the tags seed, not project docs.

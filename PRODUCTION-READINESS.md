# Production Readiness Checklist

Target: VPS + Coolify. Status is derived from the **current code** (see `DEVIATIONS.md` for context).

Legend: `[x]` verified OK in code · `[ ]` open / needs a fix · **(you)** cannot be verified from the repo, needs your action or output (see "Requests for you" at the end).

## Release blockers (fix before the site is public)

B1–B6 were fixed in code on 2026-09-19 (see "Fixed in code" right after this table); B7–B11 are open.

| # | Problem | Where | Effect |
|---|---------|-------|--------|
| B7 | No rate limiting anywhere: `/auth/*`, upload, public `POST` comments. | – | Brute force / spam / resource exhaustion. |
| B8 | No Dockerfile / build config. A Dockerfile is the chosen approach for Coolify; Coolify itself is not set up yet. | repo root | Nothing to deploy yet. |
| B9 | Media URLs are stored absolute using `S3_ENDPOINT`; `initializeBucket()` is never called. | `StorageService.ts`, `minioClient.ts` | Wrong public host baked into the DB; first upload fails without a manually created public bucket. |
| B10 | `next@16.2.6` has 11 advisories (1 critical) in `npm audit`, including a Middleware/Proxy bypass, and `src/proxy.ts` is the only auth guard for `/admin` and all writes. | `package.json` | The auth gate may be bypassable until Next is upgraded (fixed in 16.3.5). The specific proxy-bypass advisory (GHSA-6gpp-xcg3-4w24, patched in 16.2.11) needs Turbopack and a single `config.i18n.locales` entry; this app has no `i18n` block, so it most likely does not apply (CP-1, checked 2026-09-19). The other advisories on 16.2.6 still call for the upgrade. |
| B11 | `next build` prerenders `/sitemap.xml` as static content using the DB at build time (`○ /sitemap.xml` in the build output). | `src/app/sitemap.ts` | In a Docker build the DB is likely unreachable, so the sitemap would contain only locale URLs (the error is swallowed by `try/catch`); it also never updates when posts are added. |

### Fixed in code (2026-09-19, not yet verified by hand: `CHANGE-PLAN.md` CP-4)

| # | What was wrong | What changed | Still true / notes |
|---|----------------|--------------|--------------------|
| B1 | Public `GET /users` and `/users/:id` returned the whole row. | `proxy.ts` requires a JWT for every method on `/api/v1/users/**` and `/api/v1/admin/**`; `UserRepository.populate()` returns only `id`, `email`, `name`. | The `password` column only held a constant placeholder (`"admin_hashed_password"`), so no real credential was exposed; the admin email and name were. No UI page or RTK endpoint uses `/users`. |
| B2 | Public `GET /admin/comments` (all statuses). | Same proxy rule. | The admin comments page goes through `baseQueryWithReauth`, so an expired token is refreshed silently, as for writes. |
| B3 | Draft/Archived posts readable anonymously. | `utils/auth.ts` → `isAdminRequest()` (signature + `role === "admin"`, no DB) and new `utils/postVisibility.ts` (`resolveStatusFilter`, `visibleToViewer`). Anonymous callers get only `Published` from `GET /posts` and `/collections/:id/posts`; `GET /posts/:slugOrId` answers 404 for unpublished posts (not 401/403: a 401 would make `baseQueryWithReauth` send visitors to `/admin/login`). The server-rendered metadata and the UUID→slug redirect in `projects/[slug]/layout.tsx` use the same rule. | The layout was a second leak that the earlier audit had not listed: draft title, description and OG image were in the HTML for anonymous visitors. See "Known limits" below. |
| B4 | HTTP 500 returned the raw `error.message`. | `utils/apiResponse.ts`: non-`BaseError` failures return `InternalServerError` (`"An unexpected error occurred"`); the raw message and stack go to the log only. | Drizzle 0.45 errors read `Failed query: <SQL> params: <values>`, so the SQL text and bound parameters were leaking. Invalid UUIDs and malformed JSON still end in 500 (now generic); `limit` is still uncapped. |
| B5 | `JWT_SECRET` missing from `requiredEnvVars`. | Added to `requiredEnvVars` in `modules/core/env.ts`. | The earlier text ("`proxy.ts` throws on every `/admin` request") was wrong: `getJwtSecret()` runs inside a `try` in `proxy.ts`, so a missing secret redirected to `/admin/login` (or answered 401) and login failed with a 500 from `signToken`. It failed closed; it was an operations problem, not a hole. `config/test.env` has no `JWT_SECRET`, so a future test run that imports `env.ts` fails until a mock value is added (CP-4). |
| B6 | `dev-login` guarded only by a build-time flag. | `auth/dev-login/route.ts` also answers 403 when `NODE_ENV === "production"`. | `NEXT_PUBLIC_DEV_MODE` still has to be `false` in the production build variables. A local `build && start` no longer allows dev-login; use Google login. |

`npx tsc --noEmit` after these changes: 0 errors. `next build` and `npm run lint` were not re-run.

**Known limits of the B3 fix**
- The access token lives 15 minutes and the browser then drops the cookie. If the admin leaves the dashboard open longer and then searches or loads more, the server sees an anonymous caller: the list silently contains only published posts (no 401, so no silent refresh) and a draft opened in the editor is "not found" until the page is reloaded. If it hurts: send an explicit `status=all` from the dashboard and answer 401 for it when there is no token.
- `GET /media` is still public and lists every file, including images of unpublished posts.
- Only `proxy.ts` and the read filters enforce access. Controllers do not re-check on writes (only the media upload does): see CP-5.

---

## Security (priority 1)

### Google OAuth flow
- [x] Authorization-code flow; the code is exchanged server-side with `GOOGLE_CLIENT_SECRET` (never sent to the browser).
- [x] Secrets are not logged; only the error object is logged on failure.
- [ ] No `state` parameter and no PKCE (`admin/login/page.tsx`, `google/exchange/route.ts`): login CSRF is possible in principle. The blast radius is small, since only allowlisted emails get a session.
- [ ] ID token is decoded, not verified, and `aud` / `email_verified` are not checked. This is acceptable for a token received directly from Google's token endpoint over TLS, but add `email_verified === true` and `aud === GOOGLE_CLIENT_ID`.
- [ ] `redirectUri` comes from the client. Google enforces the registered list, but the server should compare it to `NEXT_PUBLIC_APP_URL + "/admin/login"`.
- [ ] `GOOGLE_CALLBACK_URL` is a required env var but is **not used** anywhere; the real redirect is `window.location.origin + "/admin/login"`.
- **(you)** Google Cloud Console: authorized redirect URI must be exactly `https://<domain>/admin/login`; OAuth consent screen status; only the production origin registered.

### Email allowlist
- [x] `ADMIN_EMAILS` (env, case-insensitive) is checked at the exchange step; an unlisted email gets 401 and no session.
- [ ] The allowlist is not re-checked afterwards; `proxy.ts` and `getUserId()` trust any validly signed JWT (`getUserId` only confirms the user row exists). Safe today because only allowlisted users receive tokens; a role/email claim check in `proxy.ts` would make it defense in depth.
- [ ] Any authenticated user can call `POST/PUT/DELETE /users` (there is no role model). Fine for a single admin, but the endpoint should be removed or restricted.

### Sessions, cookies, CSRF
- [x] Access JWT (HS256, 15 min) and refresh token (random 40 bytes, stored **hashed**, 7 days), rotated on every refresh, with reuse detection that revokes the token family.
- [x] Cookies: HttpOnly, SameSite=Strict, refresh path scoped to `/api/v1/auth`; `Secure` when `NODE_ENV=production` (dev-login always sets `secure:false`, and refuses to run when `NODE_ENV=production`).
- [x] CSRF: SameSite=Strict + JSON bodies; no cross-site form path.
- [x] Default JWT secret fallback was removed (throws if missing).
- [ ] "Premature refresh" heuristic (`auth/refresh/route.ts`) revokes the family when refreshing with >2 min of access-token life left. Parallel tabs or retries can log the admin out; consider removing it.
- [ ] Expired/used `token_sessions` rows are never purged.
- [ ] Placeholder password string is stored for admin rows; `users.password` should be nullable or a real hash, since the password login flow does not exist.

### CORS
- [x] No CORS headers are configured anywhere, so the browser's same-origin policy applies. Nothing else needs to call the API cross-origin today.

### Rate limiting
- [ ] Auth endpoints (`google/exchange`, `refresh`, `dev-login`)
- [ ] Upload (`POST /media`)
- [ ] Public comments (`POST /posts/:id/comments`; moderation via status `Review` limits the impact, but there is no captcha or throttle)
- [ ] Public list endpoints (`limit` has no upper cap in `getPaginationParams`; `?limit=1000000` is accepted)
- Options that fit Coolify: Traefik rate-limit middleware, or an in-memory limiter in `proxy.ts` (single instance only).

### Secrets management
- [x] `.env*` and `config/local.env` are git-ignored; `config/local.env` was never committed; no Google client-secret pattern (`GOCSPX`) in git history.
- [x] `config/test.env` is tracked but contains only mock values.
- [ ] `docker-compose.yml` hardcodes dev passwords (`postgres_local_password`, `minio_admin_password`). Never reuse them in production.
- [ ] `seeds/initial-data/users.json` commits an admin email and a password value.
- **(you)** Generate a strong `JWT_SECRET`, DB and MinIO credentials in Coolify's secret store.

### Input validation
- [x] Every controller validates request bodies with Zod (`common/validation/schemas.ts`).
- [x] Uploads: type allowlist (JPEG/PNG by declared MIME), size limit `NEXT_PUBLIC_MAX_FILE_SIZE_MB`, and images are re-encoded by `sharp` (metadata/EXIF dropped by default).
- [ ] MIME is client-declared and the stored extension comes from the client filename; validate by magic bytes (`sharp.metadata().format`) and derive the extension from it.
- [ ] Whole multipart body is buffered by `request.formData()` before the size check; the number of files is unbounded and they are processed sequentially.
- [ ] Query and path params are mostly unvalidated: `status`, `search`, `limit`, and non-UUID `:id` values reach Postgres and come back as 500 (with a generic message since B4 was fixed). Malformed JSON bodies also yield 500 instead of 400.
- [ ] `commentSchema.replyId` and `postId` are not checked for existence (FK error → 500).

### SQL injection
- [x] All queries go through Drizzle; the raw `sql` fragments use bound parameters (`ILIKE ${...}`), and `sql.identifier` is used for column names.
- [ ] `%` and `_` in `search` are not escaped (only affects matching, not safety).

### XSS
- [x] No `dangerouslySetInnerHTML` in the codebase; React escapes user text (comments, titles).
- [ ] Add security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) in `next.config.ts` or at the Coolify proxy. There are none now. Note that Google Fonts is loaded by CSS `@import`, which a CSP must allow, or move to `next/font`.

### Dependency vulnerabilities

`npm audit` (2026-09-19): 20 findings (1 critical, 9 high, 7 moderate, 3 low). Grouped by whether they reach the running app:

**Runtime (matters)**
- [ ] **`next@16.2.6`, critical, 11 advisories, fixed in 16.3.5.** Includes a Middleware/Proxy bypass (Turbopack + single locale), Image Optimization API issues (SVG DoS, AVIF RCE; `/_next/image` is on by default and `next/image` is used in 2 files), and several Server Actions / rewrites / Windows-only items that do not apply here (no `"use server"`, no rewrites in `next.config.ts`, Linux). The proxy-bypass advisory (GHSA-6gpp-xcg3-4w24, patched in 16.2.11) requires Turbopack and a single `config.i18n.locales` entry; this app has no `i18n` block, so it most likely does not apply (CP-1, 2026-09-19), but the upgrade is still needed for the other advisories. Also add defense in depth: verify the JWT inside the API layer (controllers), not only in `proxy.ts` (CP-5); today only the media upload does.
- [ ] **`sharp@0.34.5`, high** (libvips/libheif CVEs, fixed in 0.35.4, flagged as a breaking change). It processes every uploaded image (admin-only path). Upgrade together with Next and retest uploads.
- [ ] **`minio@8.0.7`, moderate** via `stream-json` / `query-string` / `decode-uri-component` (DoS on crafted input). The audit's suggested fix installs `minio@7.1.3`, which is a downgrade: do not accept it. The client only talks to your own MinIO, so accept the risk and watch for an upstream release.

**Build/dev only (should not ship in the runtime image)**
- [ ] The `shadcn` CLI sits in `dependencies` and drags in `@modelcontextprotocol/sdk` → `hono`, `@hono/node-server`, `express`, `body-parser`, `qs`, `ip-address`, `fast-uri`, plus `@babel/core`, `browserslist`, `ts-morph` → `brace-expansion`, `cosmiconfig` → `js-yaml`. That is most of the 20 findings. Move it to `devDependencies` (`globals.css` imports `shadcn/tailwind.css`, needed only at build time). Package name is still `next-temp`.
- [ ] `postcss` / `nanoid` (tailwind and Next's bundled postcss) and the ESLint chain (`js-yaml`, `brace-expansion`): build-time; resolved by `npm audit fix` and by the Next upgrade.

**Upgrade plan (you run these, one at a time, rebuilding in between)**
1. `npm install next@16.3.5 eslint-config-next@16.3.5` (check the versions exist with `npm view next@16.3.5 version`; `next` is pinned exactly in `package.json`; 16.2.11 fixes only the proxy-bypass advisory, the audit lists 16.3.5 for all 11)
2. `npm install sharp@0.35.4`
3. `npm audit fix` (never `--force`: it downgrades `minio`)
4. Move `shadcn` to `devDependencies`
5. `scripts/run.sh build`, then manually test login and an image upload
6. Re-run `npm audit --omit=dev` and paste the result

---

## Deployment (priority 1)

### Docker Compose / build
- [x] Dev compose works as local infrastructure: postgres 16, pinned MinIO release, pgweb; `restart: always`; data persists in `./.docker/*` bind mounts.
- [ ] Not production-ready as is: no `app` service, no Dockerfile / `.dockerignore`, no healthchecks, hardcoded creds, pgweb (8081) and the MinIO console (9001) published on host ports. Use compose only for local development; in Coolify provision Postgres/MinIO as managed resources or a separate production compose.
- [x] `next build` succeeds (Next 16.2.6, Turbopack, 29 pages, TypeScript step passes, `Proxy` recognized). All app routes are dynamic (`ƒ`); only `/icon.png`, `/robots.txt`, `/sitemap.xml` are static. The build needs the full env and touches the DB during page generation (see B11).
- [ ] Dockerfile plan: multi-stage build, `output: "standalone"`, `NEXT_PUBLIC_*` as build args, secrets as runtime env, a migration step before start, and a base image that supports `sharp`.
- [ ] `next.config.ts` is empty: consider `output: "standalone"` for a small image, and `images.remotePatterns` if `next/image` will serve MinIO images.
- [ ] Build needs the full env (`env.ts` throws at import when any of ~35 variables is missing); decide which variables are build-time vs runtime in Coolify. `NEXT_PUBLIC_*` values are inlined at build.
- [ ] Add a health endpoint (e.g. `GET /api/health` checking DB) for Coolify.

### Coolify integration (not set up yet; nothing deployed)
- [ ] Domain + Let's Encrypt (Coolify handles it); set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin.
- [ ] Env vars from `CLAUDE.md` §8 mapped to secrets (names only listed there).
- [ ] Decide the MinIO public URL. Media URLs are built from `S3_ENDPOINT` and stored absolute in the DB, so either expose MinIO on a public host and set that as `S3_ENDPOINT` from the start, or change the code to store relative keys.

### Database
- [ ] Migrations are not run automatically: no `migrate()` call and no `db:migrate` script exists. Only one SQL migration exists (`0000_tired_human_robot`). Decide: `drizzle-kit migrate` in the deploy command, or a pre-start script.
- [ ] Rollback strategy: none (Drizzle has no down migrations); rely on backups.
- [ ] Seeds: only system texts have a runner (`src/migrations/seeds/runSystemTextsSeed.ts`, run with `npx tsx`); it is not wired into `package.json`. Categories/tags/colors/collections/users seed JSONs have no loader.
- [x] The admin `users` row is created automatically on the first successful Google login (any allowlisted email), so no manual user seed is required.

### Backups **(you)**
- [ ] PostgreSQL: scheduled `pg_dump` (Coolify's scheduled backups to S3 are enough), tested restore.
- [ ] MinIO bucket: `mc mirror` / provider snapshots.
- [ ] Frequency and retention decided (suggested: daily DB, weekly bucket).

### Monitoring
- [x] Logger is winston JSON to stdout, so Coolify collects it.
- [ ] 41 `console.*` calls bypass it; there is no request logging and no error tracking.
- [ ] Uptime check on `/` and the health endpoint; disk alerts for the volumes.

---

## Code quality (priority 2)

- [x] `tsconfig` `strict: true`; zero `@ts-ignore` / `eslint-disable`.
- [ ] 283 lines with `any` / `as any` (controllers use `catch (error: any)`, services take `body: any`), against the project's "zero `any`" rule.
- [ ] Duplicated token-issuing code in three auth routes; extract an `AuthService`.
- [ ] Services bypass repositories (`CategoryService.deleteCategory`, `MediaService.deleteMedia`).
- [ ] Self-referencing FKs are missing (`categories.parent_id`, `comments.reply_id`).
- [ ] `meta.totalItems` is wrong (page size), `GET /collections/:id/posts` is double-wrapped.
- [ ] Repeated per-controller `try/catch`; a `withErrorHandling(handler)` wrapper would remove it.
- [ ] `npm run lint` fails: 425 problems (348 errors, 77 warnings). Errors: 321 `no-explicit-any`, 19 `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect"), 1 variable used before its declaration, 3 `no-require-imports` (`pull-system-texts.js`), 3 `no-empty-object-type` (empty repository interfaces), 1 `prefer-const`. Warnings: 61 unused vars, 8 `exhaustive-deps`, 7 `no-img-element`, 1 hooks/library. Lint cannot be a CI gate until this is cleaned or scoped.
- [x] `npx tsc --noEmit` prints nothing (0 errors); the TypeScript step of `next build` also passes.

## Testing (priority 3)

- [ ] Unit: none. `vitest` and testing-library are installed but there is no config and no test file.
- [ ] Integration (API): none. `test:api` (Playwright), `docker-compose.test.yml`, `config/test.env` exist, but there is no `playwright.config` and no specs.
- [ ] E2E for the auth flow: none.
- [ ] `config/test.env` has no `JWT_SECRET`, which `env.ts` now requires; add a mock value before the first test run (CP-4).
- Highest-value first tests: proxy auth matrix (which method+path needs a token), token rotation/reuse detection, category cycle guard, media in-use delete guard, post status visibility.

## Performance (priority 3)

- [ ] Images: 7 raw `<img>` (public project gallery, admin lists); `next/image` is used in 2 files only (login page, home page); stored thumbnails are ≤320 px, and the original is capped at 1000 px.
- [ ] Bundle: `import * as LucideIcons from "lucide-react"` in the public project page defeats tree-shaking and pulls the whole icon set to the client; replace with a fixed icon map.
- [ ] Fonts via CSS `@import` from Google (blocking, third-party); use `next/font`.
- [x] DB: 17 btree indexes on FKs/status; list queries use `getListRelations()` (partial select) instead of full relations.
- [ ] DB: search is `title::text ILIKE` without GIN/`pg_trgm` (sequential scan); it matches title only.
- [ ] Every page is dynamic (`headers()` in the root layout) and reads up to 2000 `system_texts` from Postgres per request; cache the texts and revalidate on admin edit (check the Next 16 caching docs in `node_modules/next/dist/docs/` for the current API).
- [ ] Public pages are client-rendered (RTK Query), so post content is not in the initial HTML. Consider server-fetching the first page of posts and the project page for SEO.
- [ ] No HTTP caching headers for public GETs.
- [ ] `DrizzleDatabase` keeps its instance in a module static; during dev HMR this can create extra pools (`postgres` default max 10 each). Cache it on `globalThis`.

---

## Results received (2026-09-19, `.claude/command-output/`)

| Command | Result | Reflected in |
|---------|--------|--------------|
| `npm audit` | 20 findings: 1 critical, 9 high, 7 moderate, 3 low | B10, "Dependency vulnerabilities" |
| `npm run lint` | **fails**: 425 problems (348 errors, 77 warnings) | "Code quality" |
| `npx tsc --noEmit` | empty output, i.e. 0 type errors | "Code quality" |
| `scripts/run.sh build` | passes (Next 16.2.6 / Turbopack, 29 pages) | "Deployment", B11 |

## Decisions and status

- **Coolify:** not set up yet. The chosen approach is a **Dockerfile** (B8 stays open until it exists).
- **Public MinIO URL:** undecided, nothing is deployed. Must be decided before the first upload in production, because it becomes `S3_ENDPOINT` and is stored in every `media` row.
- **`NEXT_PUBLIC_DEV_MODE`:** nothing is deployed. When the pipeline exists it must be `false` in the build variables (B6). Since 2026-09-19 dev-login also refuses `NODE_ENV=production`, a second guard.
- **Google OAuth:** login by email works locally without dev mode. When a domain exists, register `https://<domain>/admin/login` as an authorized redirect URI and origin.

## Still needed from you (later, one step at a time)

Tracked in `CHANGE-PLAN.md` as CP-2 and CP-4 (CP-1 was answered on 2026-09-19).

1. After you upgrade dependencies (plan in "Dependency vulnerabilities"), re-run and paste: `npm audit --omit=dev` and `scripts/run.sh build` (CP-2).
2. Check the B1–B6 fixes by hand, send the build and lint output, and decide about a mock `JWT_SECRET` in `config/test.env` (CP-4).

Code changes so far (2026-09-19): the B1–B6 fixes listed above, in `src/` only; no migration or config was changed. Everything else in this file is a recommendation.

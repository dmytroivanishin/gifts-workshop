# Production Readiness Checklist

Target: VPS + Coolify. Status is derived from the **current code** (see `DEVIATIONS.md` for context).

Legend: `[x]` verified OK in code · `[ ]` open / needs a fix · **(you)** cannot be verified from the repo, needs your action or output (see "Requests for you" at the end).

## Release blockers (fix before the site is public)

B1–B6 were fixed in code on 2026-09-19 and B7, B9, B11 on 2026-09-23 (see "Fixed in code" right after this table); B8 and B10 are open.

| # | Problem | Where | Effect |
|---|---------|-------|--------|
| B8 | No Dockerfile / build config. A Dockerfile is the chosen approach for Coolify; Coolify itself is not set up yet. | repo root | Nothing to deploy yet. |
| B10 | `next@16.2.6` has 11 advisories (1 critical) in `npm audit`, including a Middleware/Proxy bypass, and `src/proxy.ts` is the only auth guard for `/admin` and all writes. | `package.json` | The auth gate may be bypassable until Next is upgraded (fixed in 16.3.5). The specific proxy-bypass advisory (GHSA-6gpp-xcg3-4w24, patched in 16.2.11) needs Turbopack and a single `config.i18n.locales` entry; this app has no `i18n` block, so it most likely does not apply (CP-1, checked 2026-09-19). The other advisories on 16.2.6 still call for the upgrade. |

### Fixed in code (B1–B6 on 2026-09-19, not yet verified by hand: `CHANGE-PLAN.md` CP-4; B7, B9, B11 and OAuth on 2026-09-23, checked by scripts and in a browser)

| # | What was wrong | What changed | Still true / notes |
|---|----------------|--------------|--------------------|
| B1 | Public `GET /users` and `/users/:id` returned the whole row. | `proxy.ts` requires a JWT for every method on `/api/v1/users/**` and `/api/v1/admin/**`; `UserRepository.populate()` returns only `id`, `email`, `name`. | The `password` column only held a constant placeholder (`"admin_hashed_password"`), so no real credential was exposed; the admin email and name were. No UI page or RTK endpoint uses `/users`. |
| B2 | Public `GET /admin/comments` (all statuses). | Same proxy rule. | The admin comments page goes through `baseQueryWithReauth`, so an expired token is refreshed silently, as for writes. |
| B3 | Draft/Archived posts readable anonymously. | `utils/auth.ts` → `isAdminRequest()` (signature + `role === "admin"`, no DB) and new `utils/postVisibility.ts` (`resolveStatusFilter`, `visibleToViewer`). Anonymous callers get only `Published` from `GET /posts` and `/collections/:id/posts`; `GET /posts/:slugOrId` answers 404 for unpublished posts (not 401/403: a 401 would make `baseQueryWithReauth` send visitors to `/admin/login`). The server-rendered metadata and the UUID→slug redirect in `projects/[slug]/layout.tsx` use the same rule. | The layout was a second leak that the earlier audit had not listed: draft title, description and OG image were in the HTML for anonymous visitors. See "Known limits" below. |
| B4 | HTTP 500 returned the raw `error.message`. | `utils/apiResponse.ts`: non-`BaseError` failures return `InternalServerError` (`"An unexpected error occurred"`); the raw message and stack go to the log only. | Drizzle 0.45 errors read `Failed query: <SQL> params: <values>`, so the SQL text and bound parameters were leaking. Invalid UUIDs and malformed JSON still end in 500 (now generic); `limit` has been capped since 2026-09-23 (B7). |
| B5 | `JWT_SECRET` missing from `requiredEnvVars`. | Added to `requiredEnvVars` in `modules/core/env.ts`. | The earlier text ("`proxy.ts` throws on every `/admin` request") was wrong: `getJwtSecret()` runs inside a `try` in `proxy.ts`, so a missing secret redirected to `/admin/login` (or answered 401) and login failed with a 500 from `signToken`. It failed closed; it was an operations problem, not a hole. `config/test.env` has no `JWT_SECRET`, so a future test run that imports `env.ts` fails until a mock value is added (CP-4). |
| B6 | `dev-login` guarded only by a build-time flag. | `auth/dev-login/route.ts` also answers 403 when `NODE_ENV === "production"`. | `NEXT_PUBLIC_DEV_MODE` still has to be `false` in the production build variables. A local `build && start` no longer allows dev-login; use Google login. |
| B7 | No rate limiting on `/auth/*`, upload and the public comment form; `limit` had no upper bound. | `proxy.ts` calls `utils/rateLimit.ts` (`rate-limiter-flexible`, in memory) per client address: `/api/v1/auth/*` 20 per minute, `POST /posts/:id/comments` 5 per 10 minutes, `POST /media` 30 per minute. Over the limit the answer is 429 `TOO_MANY_REQUESTS` (standard envelope) with `Retry-After`. `getPaginationParams` caps `limit` at `MAX_PAGE_SIZE = 100`; `GET /posts` defaults to page 1 with 20 items; the categories controller now uses the shared helper instead of its own parsing. | Counters live in one process: right for one Coolify container, several instances need a shared store (`RateLimiterRedis`) or Traefik's rate-limit middleware. The address is the last `X-Forwarded-For` entry, which assumes Traefik is the only proxy in front (behind Cloudflare all visitors would share one key). Ordinary GETs are not limited on purpose. In `next dev` every request has the key `unknown`, so all auth calls share the 20 per minute. New dependency `rate-limiter-flexible@11.2.1` (no dependencies of its own). |
| B9 | Media URLs were built from `S3_ENDPOINT`, the address the server connects to (an internal host in Docker or Coolify), and stored absolute; `initializeBucket()` was never called. | `S3_PUBLIC_URL` is a required env var (`env.ts`); `StorageService` builds `${S3_PUBLIC_URL}/${bucket}/${object}` (checked with `new URL`, trailing slash trimmed). `ensureBucket()` in `minioClient.ts` runs before the first upload of a process: it creates the bucket when missing and sets public read only when the bucket has no policy (an existing policy is kept); a failure is not cached. `initializeBucket()` is removed. | Stored URLs are still absolute, so changing `S3_PUBLIC_URL` later means a SQL `replace()` on `media` (`CHANGE-PLAN.md` CP-8); `saveMedia` also accepts external URLs. Checked on 2026-09-23: 7 scenarios on throwaway buckets and one real upload through the admin on the dev server. `S3_FORCE_PATH_STYLE` is required but unused, and deleting a media row leaves its two objects in the bucket (both in CP-6). |
| B11 | `/sitemap.xml` was prerendered at build time from the DB. | `app/sitemap.ts` exports `dynamic = "force-dynamic"`, so it is built on every request (`ƒ /sitemap.xml` in the build output). | Only `Published` posts are listed. `next build` now passes with an unreachable database (checked 2026-09-23). Each request queries the DB; add HTTP caching if that ever matters. |
| OAuth | Google login had no `state`/PKCE, took the redirect address from the client and only decoded the ID token. | `POST /api/v1/auth/google/start` builds the authorize URL with a random `state` and a PKCE S256 challenge and keeps both in an HttpOnly cookie (`oauthState`, SameSite=Lax, path `/api/v1/auth`, 10 minutes, single use). `google/exchange` compares the state (timing-safe), sends `code_verifier` and the server-side redirect address (`NEXT_PUBLIC_APP_URL` + `/admin/login`), and verifies the ID token with `jwtVerify` against Google's keys (RS256, issuer, audience = `GOOGLE_CLIENT_ID`, expiry), then requires `email_verified === true`. Code: `utils/googleOAuth.ts`; the unused `/auth/config` route is removed. | Checked by scripts (17 unit, 9 HTTP, 6 browser checks) and by a real Google login by the user on 2026-09-23. `GOOGLE_CALLBACK_URL` is still required by `env.ts` but unused (CP-6). No `nonce` check: `state` and PKCE already bind the code to the browser. |

State on 2026-09-23: `npx tsc --noEmit` 0 errors; `next build` passes (exit 0); `npm run lint` 418 problems (345 errors, 73 warnings), see "Code quality".

**Known limits of the B3 fix**
- The access token lives 15 minutes and the browser then drops the cookie. If the admin leaves the dashboard open longer and then searches or loads more, the server sees an anonymous caller: the list silently contains only published posts (no 401, so no silent refresh) and a draft opened in the editor is "not found" until the page is reloaded. If it hurts: send an explicit `status=all` from the dashboard and answer 401 for it when there is no token.
- `GET /media` is still public and lists every file, including images of unpublished posts.
- Only `proxy.ts` and the read filters enforce access. Controllers do not re-check on writes (only the media upload does): see CP-5.

---

## Security (priority 1)

### Google OAuth flow
- [x] Authorization-code flow; the code is exchanged server-side with `GOOGLE_CLIENT_SECRET` (never sent to the browser).
- [x] Secrets are not logged; a failed login is logged through `logger` with the error message only.
- [x] `state` and PKCE (S256) protect the flow (fixed 2026-09-23, see "Fixed in code" → OAuth): the server keeps them in a single-use HttpOnly cookie and checks them when Google sends the user back.
- [x] The ID token is verified against Google's keys (signature, issuer, audience = `GOOGLE_CLIENT_ID`, expiry) and must carry `email_verified === true`.
- [x] The redirect address is fixed on the server (`NEXT_PUBLIC_APP_URL` + `/admin/login`); the client sends only `code` and `state`.
- [ ] `GOOGLE_CALLBACK_URL` is a required env var but is **not used** anywhere (its value in `config/local.env` is a placeholder); drop it from the required list (CP-6).
- **(you)** Google Cloud Console: authorized redirect URI must be exactly `https://<domain>/admin/login` (the localhost one can stay for development); OAuth consent screen status. `NEXT_PUBLIC_APP_URL` must be the same origin, as a build variable.

### Email allowlist
- [x] `ADMIN_EMAILS` (env, case-insensitive) is checked at the exchange step; an unlisted email gets 401 and no session.
- [ ] The allowlist is not re-checked afterwards; `proxy.ts` and `getUserId()` trust any validly signed JWT (`getUserId` only confirms the user row exists). Safe today because only allowlisted users receive tokens; a role/email claim check in `proxy.ts` would make it defense in depth.
- [ ] Any authenticated user can call `POST/PUT/DELETE /users` (there is no role model). Fine for a single admin, but the endpoint should be removed or restricted.

### Sessions, cookies, CSRF
- [x] Access JWT (HS256, 15 min) and refresh token (random 40 bytes, stored **hashed**, 7 days), rotated on every refresh, with reuse detection that revokes the token family.
- [x] Cookies: HttpOnly, SameSite=Strict, refresh path scoped to `/api/v1/auth`; `Secure` when `NODE_ENV=production` (dev-login always sets `secure:false`, and refuses to run when `NODE_ENV=production`).
- [x] CSRF: SameSite=Strict + JSON bodies; no cross-site form path.
- [x] The login `oauthState` cookie is HttpOnly, SameSite=Lax (the browser returns from Google by a cross-site redirect), path `/api/v1/auth`, 10 minutes, deleted on every exchange attempt; `Secure` when `NODE_ENV=production`.
- [x] Default JWT secret fallback was removed (throws if missing).
- [ ] "Premature refresh" heuristic (`auth/refresh/route.ts`) revokes the family when refreshing with >2 min of access-token life left. Parallel tabs or retries can log the admin out; consider removing it.
- [ ] Expired/used `token_sessions` rows are never purged.
- [ ] Placeholder password string is stored for admin rows; `users.password` should be nullable or a real hash, since the password login flow does not exist.

### CORS
- [x] No CORS headers are configured anywhere, so the browser's same-origin policy applies. Nothing else needs to call the API cross-origin today.

### Rate limiting
- [x] Auth endpoints (`/api/v1/auth/*`: `google/start`, `google/exchange`, `refresh`, `logout`, `dev-login`): 20 requests per minute per client address.
- [x] Upload (`POST /media`): 30 per minute.
- [x] Public comments (`POST /posts/:id/comments`): 5 per 10 minutes. Moderation via status `Review` still applies; there is no captcha.
- [x] Public list endpoints: `limit` is capped at 100 (`MAX_PAGE_SIZE` in `utils/paginationUtils.ts`); `GET /posts` defaults to 20 per page. Lookup lists (categories, tags, colors, collections, media) stay unpaginated when no `limit` is given, because the admin pages call them that way.
- Implemented in `proxy.ts` + `utils/rateLimit.ts` with `rate-limiter-flexible` (in memory), 2026-09-23. Over the limit: 429 `TOO_MANY_REQUESTS` with `Retry-After`.
- [ ] Ordinary public GETs (posts, categories, tags, …) are not limited; a scraper can still hammer them. Traefik's rate-limit middleware is the better place for that at deploy time.
- [ ] Counters live in the memory of one process: fine for a single container, several instances need a shared store (`RateLimiterRedis`) or Traefik.
- [ ] The client address is the last `X-Forwarded-For` entry (assumes Traefik is the only proxy; behind Cloudflare use `CF-Connecting-IP` instead, or every visitor shares one key). In `next dev` there is no proxy, so all requests share the key `unknown`.
- [ ] Admin-only writes other than uploads are not throttled beyond the JWT check (one admin, low risk).

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
- [ ] Query and path params are mostly unvalidated: `status`, `search` and non-UUID `:id` values reach Postgres and come back as 500 (with a generic message since B4 was fixed). Malformed JSON bodies also yield 500 instead of 400. (`page` and `limit` are sanitized and capped in `getPaginationParams` since 2026-09-23.)
- [ ] `commentSchema.replyId` and `postId` are not checked for existence (FK error → 500).

### SQL injection
- [x] All queries go through Drizzle; the raw `sql` fragments use bound parameters (`ILIKE ${...}`), and `sql.identifier` is used for column names.
- [ ] `%` and `_` in `search` are not escaped (only affects matching, not safety).

### XSS
- [x] No `dangerouslySetInnerHTML` in the codebase; React escapes user text (comments, titles).
- [ ] Add security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) in `next.config.ts` or at the Coolify proxy. There are none now. Note that Google Fonts is loaded by CSS `@import`, which a CSP must allow, or move to `next/font`.

### Dependency vulnerabilities

`npm audit` (2026-09-19): 20 findings (1 critical, 9 high, 7 moderate, 3 low). On 2026-09-23 it reports 28 (1 critical, 10 high, 14 moderate, 3 low): `rate-limiter-flexible` (added that day, no dependencies, in no advisory) is not involved; the 8 extra package names are dev tooling with newly published advisories (`vitest`, `@vitest/ui`, `@vitest/mocker`, `esbuild`, `@esbuild-kit/*`, `drizzle-kit` via esbuild, and `undici` via `jsdom`; `npm ls undici --omit=dev` is empty). Output: `.claude/command-output/npm_audit_2026-09-23.json`. The number that matters is `npm audit --omit=dev` after the upgrade (`CHANGE-PLAN.md` CP-2). The grouping below is the 2026-09-19 analysis:

**Runtime (matters)**
- [ ] **`next@16.2.6`, critical, 11 advisories, fixed in 16.3.5.** Includes a Middleware/Proxy bypass (Turbopack + single locale), Image Optimization API issues (SVG DoS, AVIF RCE; `/_next/image` is on by default and `next/image` is used in 2 files), and several Server Actions / rewrites / Windows-only items that do not apply here (no `"use server"`, no rewrites in `next.config.ts`, Linux). The proxy-bypass advisory (GHSA-6gpp-xcg3-4w24, patched in 16.2.11) requires Turbopack and a single `config.i18n.locales` entry; this app has no `i18n` block, so it most likely does not apply (CP-1, 2026-09-19), but the upgrade is still needed for the other advisories. Also add defense in depth: verify the JWT inside the API layer (controllers), not only in `proxy.ts` (CP-5); today only the media upload does.
- [ ] **`sharp@0.34.5`, high** (libvips/libheif CVEs, fixed in 0.35.4, flagged as a breaking change). It processes every uploaded image (admin-only path). Upgrade together with Next and retest uploads.
- [ ] **`minio@8.0.7`, moderate** via `stream-json` / `query-string` / `decode-uri-component` (DoS on crafted input). The audit's suggested fix installs `minio@7.1.3`, which is a downgrade: do not accept it. The client only talks to your own MinIO, so accept the risk and watch for an upstream release.
- [x] **`rate-limiter-flexible@11.2.1`** (added 2026-09-23): ISC, no dependencies, no install scripts, ships its own types, in no advisory. One maintainer.

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
- [x] `next build` succeeds (2026-09-23: Next 16.2.6, Turbopack, 28 pages, TypeScript step passes, `Proxy` recognized). All app routes are dynamic (`ƒ`, including `/sitemap.xml`); only `/icon.png` and `/robots.txt` are static. The build needs the full env but no database: it also passes with an unreachable `DB_URI` (checked 2026-09-23), which is what a Docker build has. Use `bash scripts/run.sh build` (the script is not executable).
- [ ] Dockerfile plan: multi-stage build, `output: "standalone"`, `NEXT_PUBLIC_*` as build args, secrets as runtime env, a migration step before start, and a base image that supports `sharp`.
- [ ] `next.config.ts` is empty: consider `output: "standalone"` for a small image, and `images.remotePatterns` if `next/image` will serve MinIO images.
- [ ] Build needs the full env (`env.ts` throws at import when any of the 34 required variables is missing); decide which variables are build-time vs runtime in Coolify. `NEXT_PUBLIC_*` values are inlined at build.
- [ ] Add a health endpoint (e.g. `GET /api/health` checking DB) for Coolify.

### Coolify integration (not set up yet; nothing deployed)
- [ ] Domain + Let's Encrypt (Coolify handles it); set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin.
- [ ] Env vars from `CLAUDE.md` §9 mapped to secrets (names only listed there), including `S3_PUBLIC_URL`.
- [ ] Set `S3_PUBLIC_URL` to the public MinIO address once it is known (`CHANGE-PLAN.md` CP-8): a stable host such as `https://media.<domain>` that browsers can reach, with anonymous read on the bucket (`ensureBucket()` sets that when the bucket has no policy). `S3_ENDPOINT` stays the internal address the server connects to. The value is stored in every `media` row, so changing it later means a SQL `replace()`.
- [ ] Google OAuth for the production domain: register `https://<domain>/admin/login` as an authorized redirect URI and set `NEXT_PUBLIC_APP_URL` to the same origin in the build variables.

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
- [ ] 40 `console.*` calls bypass it; there is no request logging and no error tracking.
- [ ] Uptime check on `/` and the health endpoint; disk alerts for the volumes.

---

## Code quality (priority 2)

- [x] `tsconfig` `strict: true`; zero `@ts-ignore` / `eslint-disable`.
- [ ] About 280 lines with `any` / `as any` (318 `no-explicit-any` lint errors; controllers use `catch (error: any)`, services take `body: any`), against the project's "zero `any`" rule. New code (rate limiter, storage, Google login) uses `unknown` and explicit types.
- [ ] Duplicated token-issuing code in three auth routes; extract an `AuthService`.
- [ ] Services bypass repositories (`CategoryService.deleteCategory`, `MediaService.deleteMedia`).
- [ ] Self-referencing FKs are missing (`categories.parent_id`, `comments.reply_id`).
- [ ] `meta.totalItems` is wrong (page size), `GET /collections/:id/posts` is double-wrapped.
- [ ] Repeated per-controller `try/catch`; a `withErrorHandling(handler)` wrapper would remove it.
- [ ] `npm run lint` fails (2026-09-23): 418 problems (345 errors, 73 warnings), down from 425 (348 errors, 77 warnings) on 2026-09-19. Errors: 318 `no-explicit-any`, 19 `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect"), 1 `react-hooks/immutability` (a function used before its declaration), 3 `no-require-imports` (`pull-system-texts.js`), 3 `no-empty-object-type` (empty repository interfaces), 1 `prefer-const`. Warnings: 57 unused vars, 8 `exhaustive-deps`, 7 `no-img-element`, 1 hooks/library. Lint cannot be a CI gate until this is cleaned or scoped. Saved: `.claude/command-output/lint_2026-09-23.json`.
- [x] `npx tsc --noEmit` prints nothing (0 errors); the TypeScript step of `next build` also passes.

## Testing (priority 3)

- [ ] Unit: none. `vitest` and testing-library are installed but there is no config and no test file.
- [ ] Integration (API): none. `test:api` (Playwright), `docker-compose.test.yml`, `config/test.env` exist, but there is no `playwright.config` and no specs.
- [ ] E2E for the auth flow: none.
- [ ] `config/test.env` has no `JWT_SECRET`, which `env.ts` requires; add a mock value before the first test run (CP-4). It has `S3_PUBLIC_URL` since 2026-09-23 (added by the user).
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

## Results received (`.claude/command-output/`; dated 2026-09-19 unless the row says otherwise)

| Command | Result | Reflected in |
|---------|--------|--------------|
| `npm audit` | 20 findings: 1 critical, 9 high, 7 moderate, 3 low | B10, "Dependency vulnerabilities" |
| `npm run lint` | **fails**: 425 problems (348 errors, 77 warnings) | "Code quality" |
| `npx tsc --noEmit` | empty output, i.e. 0 type errors | "Code quality" |
| `scripts/run.sh build` | passes (Next 16.2.6 / Turbopack, 29 pages) | "Deployment", B11 |
| `npm audit --json` (2026-09-23, run by Claude) | 28 findings: 1 critical, 10 high, 14 moderate, 3 low; the 8 new names are dev tooling | "Dependency vulnerabilities", CP-2 |
| `npm run lint` (2026-09-23, run by Claude) | **fails**: 418 problems (345 errors, 73 warnings) | "Code quality" |
| `bash scripts/run.sh build` (2026-09-23, run by Claude) | passes (28 pages, `/sitemap.xml` dynamic); also passes with an unreachable database | "Deployment", B11 |

## Decisions and status

- **Coolify:** not set up yet. The chosen approach is a **Dockerfile** (B8 stays open until it exists).
- **Public MinIO URL:** not chosen (nothing is deployed, no domain yet). The code no longer depends on the choice: the required `S3_PUBLIC_URL` is set when the address is known (`CHANGE-PLAN.md` CP-8); locally it equals `S3_ENDPOINT`. It must be set before the first upload in production, because it is stored in every `media` row.
- **`NEXT_PUBLIC_DEV_MODE`:** nothing is deployed. When the pipeline exists it must be `false` in the build variables (B6). Since 2026-09-19 dev-login also refuses `NODE_ENV=production`, a second guard.
- **Google OAuth:** login by email works locally without dev mode (checked by the user on 2026-09-23 after the `state`/PKCE change). When a domain exists, register `https://<domain>/admin/login` as an authorized redirect URI, set `NEXT_PUBLIC_APP_URL` to that origin, and keep the localhost URI for development.

## Still needed from you (later, one step at a time)

Tracked in `CHANGE-PLAN.md` as CP-2 and CP-4 (CP-1 was answered on 2026-09-19); CP-8 (public MinIO address) waits for a domain and a server.

1. After you upgrade dependencies (plan in "Dependency vulnerabilities"), re-run and paste: `npm audit --omit=dev` and `scripts/run.sh build` (CP-2).
2. Check the B1–B6 fixes by hand, send the build and lint output, and decide about a mock `JWT_SECRET` in `config/test.env` (CP-4).

Code changes so far: the B1–B6 fixes (2026-09-19); rate limiting with the `limit` cap, the dynamic sitemap, `S3_PUBLIC_URL` with `ensureBucket()`, and the Google login hardening (2026-09-23), in `src/` plus one new dependency (`rate-limiter-flexible`) in `package.json`. No migration was changed; `config/test.env` got an `S3_PUBLIC_URL` line from the user. Everything else in this file is a recommendation.

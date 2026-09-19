# Production Readiness Checklist

Target: VPS + Coolify. Status is derived from the **current code** (see `DEVIATIONS.md` for context).

Legend: `[x]` verified OK in code · `[ ]` open / needs a fix · **(you)** cannot be verified from the repo, needs your action or output (see "Requests for you" at the end).

## Release blockers (fix before the site is public)

| # | Problem | Where | Effect |
|---|---------|-------|--------|
| B1 | `proxy.ts` protects only `POST/PUT/PATCH/DELETE`. `GET /api/v1/users` and `/users/:id` are public and return the whole row, including the `password` column. | `src/proxy.ts`, `repositories/drizzle/userRepository.ts` | Admin email and password field readable by anyone. |
| B2 | `GET /api/v1/admin/comments` is public (same reason), returning comments in every status. | `src/proxy.ts` | Unmoderated/rejected comments and commenter names are exposed. |
| B3 | Drafts and archived posts are readable anonymously: `GET /posts` has no default status filter (`?status=Draft` works), `GET /posts/:slug` and `GET /collections/:id/posts` ignore status. The public UI filters on the client side only. | `postController.ts`, `postService.ts`, `collections/[id]/posts/route.ts` | Unpublished work leaks. |
| B4 | Non-operational errors return HTTP 500 with the raw `error.message` (DB errors, `sharp` errors, invalid UUID text, JSON parse errors). | `src/utils/apiResponse.ts` | Internal details leak. |
| B5 | `JWT_SECRET` is **not** in `requiredEnvVars` (`modules/core/env.ts`). A missing secret only surfaces on the first token operation, and `proxy.ts` then throws on every `/admin` request. | `env.ts`, `proxy.ts`, `utils/jwt.ts` | Misconfigured deploy looks like a random 500. |
| B6 | `NEXT_PUBLIC_DEV_MODE` enables `POST /auth/dev-login` (issues an admin session without Google). It is a `NEXT_PUBLIC_` variable, so it is baked in at **build** time, and it is required to be present. | `auth/dev-login/route.ts`, `env.ts` | If it is `true` in the production build, anyone can become admin. |
| B7 | No rate limiting anywhere: `/auth/*`, upload, public `POST` comments. | – | Brute force / spam / resource exhaustion. |
| B8 | No Dockerfile / build config. A Dockerfile is the chosen approach for Coolify; Coolify itself is not set up yet. | repo root | Nothing to deploy yet. |
| B9 | Media URLs are stored absolute using `S3_ENDPOINT`; `initializeBucket()` is never called. | `StorageService.ts`, `minioClient.ts` | Wrong public host baked into the DB; first upload fails without a manually created public bucket. |
| B10 | `next@16.2.6` has 11 advisories (1 critical) in `npm audit`, including a Middleware/Proxy bypass, and `src/proxy.ts` is the only auth guard for `/admin` and all writes. | `package.json` | The auth gate may be bypassable until Next is upgraded (fixed in 16.3.5). Applicability to this setup is unconfirmed, see the last section. |
| B11 | `next build` prerenders `/sitemap.xml` as static content using the DB at build time (`○ /sitemap.xml` in the build output). | `src/app/sitemap.ts` | In a Docker build the DB is likely unreachable, so the sitemap would contain only locale URLs (the error is swallowed by `try/catch`); it also never updates when posts are added. |

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
- [x] Cookies: HttpOnly, SameSite=Strict, refresh path scoped to `/api/v1/auth`; `Secure` when `NODE_ENV=production` (dev-login always sets `secure:false`).
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
- [ ] Query and path params are mostly unvalidated: `status`, `search`, `limit`, and non-UUID `:id` values reach Postgres and come back as 500 (see B4). Malformed JSON bodies also yield 500 instead of 400.
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
- [ ] **`next@16.2.6`, critical, 11 advisories, fixed in 16.3.5.** Includes a Middleware/Proxy bypass (Turbopack + single locale), Image Optimization API issues (SVG DoS, AVIF RCE; `/_next/image` is on by default and `next/image` is used in 2 files), and several Server Actions / rewrites / Windows-only items that do not apply here (no `"use server"`, no rewrites in `next.config.ts`, Linux). Treat the proxy bypass as applicable until confirmed, since `proxy.ts` guards everything (B10). Also add defense in depth: verify the JWT inside the API layer (controllers), not only in `proxy.ts`.
- [ ] **`sharp@0.34.5`, high** (libvips/libheif CVEs, fixed in 0.35.4, flagged as a breaking change). It processes every uploaded image (admin-only path). Upgrade together with Next and retest uploads.
- [ ] **`minio@8.0.7`, moderate** via `stream-json` / `query-string` / `decode-uri-component` (DoS on crafted input). The audit's suggested fix installs `minio@7.1.3`, which is a downgrade: do not accept it. The client only talks to your own MinIO, so accept the risk and watch for an upstream release.

**Build/dev only (should not ship in the runtime image)**
- [ ] The `shadcn` CLI sits in `dependencies` and drags in `@modelcontextprotocol/sdk` → `hono`, `@hono/node-server`, `express`, `body-parser`, `qs`, `ip-address`, `fast-uri`, plus `@babel/core`, `browserslist`, `ts-morph` → `brace-expansion`, `cosmiconfig` → `js-yaml`. That is most of the 20 findings. Move it to `devDependencies` (`globals.css` imports `shadcn/tailwind.css`, needed only at build time). Package name is still `next-temp`.
- [ ] `postcss` / `nanoid` (tailwind and Next's bundled postcss) and the ESLint chain (`js-yaml`, `brace-expansion`): build-time; resolved by `npm audit fix` and by the Next upgrade.

**Upgrade plan (you run these, one at a time, rebuilding in between)**
1. `npm install next@16.3.5 eslint-config-next@16.3.5` (check the versions exist; `next` is pinned exactly in `package.json`)
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
- **`NEXT_PUBLIC_DEV_MODE`:** nothing is deployed. When the pipeline exists it must be `false` in the build variables (B6).
- **Google OAuth:** login by email works locally without dev mode. When a domain exists, register `https://<domain>/admin/login` as an authorized redirect URI and origin.

## Still needed from you (later, one step at a time)

Tracked in `CHANGE-PLAN.md` as CP-1 and CP-2.

1. Read the Next.js advisory GHSA-6gpp-xcg3-4w24 ("Middleware / Proxy bypass in App Router applications using Turbopack and single locale") and tell me whether its conditions match this app, or tell me to look it up myself. This project has no `i18n` block in `next.config.ts` and does its own `[locale]` routing in `proxy.ts`, so it may not match, but I cannot confirm it offline.
2. After you upgrade dependencies (plan in "Dependency vulnerabilities"), re-run and paste: `npm audit --omit=dev` and `scripts/run.sh build`.

Everything in this file is a recommendation. No code, migration or config has been changed.

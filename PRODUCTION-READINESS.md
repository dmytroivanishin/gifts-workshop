# Production Readiness Checklist

Target: VPS + Coolify. Status is derived from the **current code** (see `DEVIATIONS.md` for context).

Legend: `[x]` verified OK in code · `[ ]` open / needs a fix · **(you)** cannot be verified from the repo, needs your action or output (see "Requests for you" at the end).

## Release blockers (fix before the site is public)

B1–B6 were fixed in code on 2026-09-19, B7, B9, B11 on 2026-09-23, B12 on 2026-09-28, and B10 on 2026-10-05 (see "Fixed in code" right after this table); B8 is open.

| # | Problem | Where | Effect |
|---|---------|-------|--------|
| B8 | No Dockerfile / build config. A Dockerfile is the chosen approach for Coolify; Coolify itself is not set up yet. | repo root | Nothing to deploy yet. |
| ~~B10~~ | `next@16.2.6` has 11 advisories (1 critical) in `npm audit`, including a Middleware/Proxy bypass, and `src/proxy.ts` is the only auth guard for `/admin` and all writes. | `package.json` | **Fixed 2026-10-05**: `next` upgraded to 16.3.8 (the original plan's 16.3.5 target had since gained its own critical RCE advisory in `next/og`'s `ImageResponse`, unused in this codebase but a trivial patch bump away — taken anyway), `sharp` to 0.35.4, `eslint-config-next` to 16.3.8, `shadcn` moved to `devDependencies`. `npm audit --omit=dev`: 0 critical, 0 high, 5 moderate (all already-known, see "Dependency vulnerabilities" below). See "Fixed in code" row below for verification detail. |

### Fixed in code (B1–B6 on 2026-09-19, not yet verified by hand: `CHANGE-PLAN.md` CP-4; B7, B9, B11 and OAuth on 2026-09-23, checked by scripts and in a browser; B12 on 2026-09-28, checked with `tsc`/`next build` and a route-consumer check)

| # | What was wrong | What changed | Still true / notes |
|---|----------------|--------------|--------------------|
| B1 | Public `GET /users` and `/users/:id` returned the whole row. | `proxy.ts` requires a JWT for every method on `/api/v1/users/**` and `/api/v1/admin/**`; `UserRepository.populate()` returns only `id`, `email`, `name`. | The `password` column only held a constant placeholder (`"admin_hashed_password"`), so no real credential was exposed; the admin email and name were. No UI page or RTK endpoint uses `/users`. |
| B2 | Public `GET /admin/comments` (all statuses). | Same proxy rule. | The admin comments page goes through `baseQueryWithReauth`, so an expired token is refreshed silently, as for writes. |
| B3 | Draft/Archived posts readable anonymously. | `utils/auth.ts` → `isAdminRequest()` (signature + `role === "admin"`, no DB) and new `utils/postVisibility.ts` (`resolveStatusFilter`, `visibleToViewer`). Anonymous callers get only `Published` from `GET /posts` and `/collections/:id/posts`; `GET /posts/:slugOrId` answers 404 for unpublished posts (not 401/403: a 401 would make `baseQueryWithReauth` send visitors to `/admin/login`). The server-rendered metadata and the UUID→slug redirect in `projects/[slug]/layout.tsx` use the same rule. | The layout was a second leak that the earlier audit had not listed: draft title, description and OG image were in the HTML for anonymous visitors. See "Known limits" below. |
| B4 | HTTP 500 returned the raw `error.message`. | `utils/apiResponse.ts`: non-`BaseError` failures return `InternalServerError` (`"An unexpected error occurred"`); the raw message and stack go to the log only. | Drizzle 0.45 errors read `Failed query: <SQL> params: <values>`, so the SQL text and bound parameters were leaking. Invalid UUIDs and malformed JSON still end in 500 (now generic); `limit` has been capped since 2026-09-23 (B7). |
| B5 | `JWT_SECRET` missing from `requiredEnvVars`. | Added to `requiredEnvVars` in `modules/core/env.ts`. | The earlier text ("`proxy.ts` throws on every `/admin` request") was wrong: `getJwtSecret()` runs inside a `try` in `proxy.ts`, so a missing secret redirected to `/admin/login` (or answered 401) and login failed with a 500 from `signToken`. It failed closed; it was an operations problem, not a hole. `config/test.env` has no `JWT_SECRET`, so a future test run that imports `env.ts` fails until a mock value is added (CP-4). |
| B6 | `dev-login` guarded only by a build-time flag. | `auth/dev-login/route.ts` also answers 403 when `NODE_ENV === "production"`. | `NEXT_PUBLIC_DEV_MODE` still has to be `false` in the production build variables. A local `build && start` no longer allows dev-login; use Google login. |
| B7 | No rate limiting on `/auth/*`, upload and the public comment form; `limit` had no upper bound. | `proxy.ts` calls `utils/rateLimit.ts` (`rate-limiter-flexible`, in memory) per client address: `/api/v1/auth/*` 20 per minute, `POST /posts/:id/comments` 5 per 10 minutes, `POST /media` 30 per minute. Over the limit the answer is 429 `TOO_MANY_REQUESTS` (standard envelope) with `Retry-After`. `getPaginationParams` caps `limit` at `MAX_PAGE_SIZE = 100`; `GET /posts` defaults to page 1 with 20 items; the categories controller now uses the shared helper instead of its own parsing. | Counters live in one process: right for one Coolify container, several instances need a shared store (`RateLimiterRedis`) or Traefik's rate-limit middleware. The address is the last `X-Forwarded-For` entry, which assumes Traefik is the only proxy in front (behind Cloudflare all visitors would share one key). Ordinary GETs are not limited on purpose. In `next dev` every request has the key `unknown`, so all auth calls share the 20 per minute. New dependency `rate-limiter-flexible@11.2.1` (no dependencies of its own). |
| B9 | Media URLs were built from `S3_ENDPOINT`, the address the server connects to (an internal host in Docker or Coolify), and stored absolute; `initializeBucket()` was never called. | `S3_PUBLIC_URL` is a required env var (`env.ts`); `StorageService` builds `${S3_PUBLIC_URL}/${bucket}/${object}` (checked with `new URL`, trailing slash trimmed). `ensureBucket()` in `minioClient.ts` runs before the first upload of a process: it creates the bucket when missing and sets public read only when the bucket has no policy (an existing policy is kept); a failure is not cached. `initializeBucket()` is removed. | Stored URLs are still absolute, so changing `S3_PUBLIC_URL` later means a SQL `replace()` on `media` (`CHANGE-PLAN.md` CP-8); `saveMedia` also accepts external URLs. Checked on 2026-09-23: 7 scenarios on throwaway buckets and one real upload through the admin on the dev server. `S3_FORCE_PATH_STYLE` was required but unused (dropped from the list 2026-09-28); deleting a media row now removes its two objects from the bucket too (2026-09-28, `StorageService.deleteImage()`). |
| B11 | `/sitemap.xml` was prerendered at build time from the DB. | `app/sitemap.ts` exports `dynamic = "force-dynamic"`, so it is built on every request (`ƒ /sitemap.xml` in the build output). | Only `Published` posts are listed. `next build` now passes with an unreachable database (checked 2026-09-23). Each request queries the DB; add HTTP caching if that ever matters. |
| OAuth | Google login had no `state`/PKCE, took the redirect address from the client and only decoded the ID token. | `POST /api/v1/auth/google/start` builds the authorize URL with a random `state` and a PKCE S256 challenge and keeps both in an HttpOnly cookie (`oauthState`, SameSite=Lax, path `/api/v1/auth`, 10 minutes, single use). `google/exchange` compares the state (timing-safe), sends `code_verifier` and the server-side redirect address (`NEXT_PUBLIC_APP_URL` + `/admin/login`), and verifies the ID token with `jwtVerify` against Google's keys (RS256, issuer, audience = `GOOGLE_CLIENT_ID`, expiry), then requires `email_verified === true`. Code: `utils/googleOAuth.ts`; the unused `/auth/config` route is removed. | Checked by scripts (17 unit, 9 HTTP, 6 browser checks) and by a real Google login by the user on 2026-09-23. `GOOGLE_CALLBACK_URL` was required by `env.ts` but unused; dropped from the list 2026-09-28. No `nonce` check: `state` and PKCE already bind the code to the browser. |
| B12 | Public `GET /api/v1/media` (list and by id) returned every uploaded file with no auth, including images of Draft/Archived posts that `GET /posts` already hides from anonymous readers (B3). | `proxy.ts`'s `isAdminOnlyResource` pattern now also matches `/api/v1/media(/|$)`, so every method needs a JWT — same treatment as `/users/**` and `/admin/**`, not just the write methods. | Checked: the endpoint has exactly one consumer in the codebase, the admin media picker (`admin/projects/[id]/page.tsx`); the public site never calls it, so nothing anonymous breaks. `tsc --noEmit` clean, `next build` passes (28 pages). |

State on 2026-09-23: `npx tsc --noEmit` 0 errors; `next build` passes (exit 0); `npm run lint` 418 problems (345 errors, 73 warnings), see "Code quality". Re-run 2026-09-28 twice, after the B12/security-header/`replyToComment`/CP-7 fixes and again after the dashboard-status/`deleteMedia`/env-cleanup/`POST /users`/upload-format fixes, again 2026-10-01 after the `createComment`-postId/`users`-write-removal/`token_sessions`-purge/search-escaping fixes, again 2026-10-02 after the `replyId`-check/email-claim/`adminWrite`-rate-limit/upload-file-cap/seeds-cleanup fixes, again the same day (second round) after the malformed-JSON/non-UUID-id/services-bypass-repositories/duplicated-session-issuing/public-gallery-`next/image` fixes, and again 2026-10-05 after the parentId-existence-check/LucideIcons/DrizzleDatabase-globalThis/description-search/next-font fixes: `tsc --noEmit` and `next build` still clean every time; lint and `npm audit` were not re-run (no dependency changed), so the 2026-09-23 numbers still stand until the next row. **2026-10-05 (second round, dependency upgrade + `system_texts` caching):** `tsc --noEmit`/`next build` clean (same 28 routes); `npm run lint` 420 problems (349 errors, 71 warnings — a small shift from the `eslint-config-next` version bump, not a regression); `npm audit --omit=dev` 0 critical, 0 high, 5 moderate. Outputs: `.claude/command-output/lint_2026-10-05.json`, `npm_audit_omit_dev_2026-10-05.json`.

**Known limits of the B3 fix**
- The access token lives 15 minutes and the browser then drops the cookie. A draft opened in the editor is still "not found" until the page is reloaded (unaffected by the fix below — the editor fetches a single post by id/slug through `visibleToViewer`, not the list).
- **Fixed 2026-09-28:** the dashboard's post list used to silently narrow to `Published` only once the token expired (no 401, so no silent refresh, no signal anything was wrong). It now sends an explicit `status=all`; `resolveStatusFilter` (`utils/postVisibility.ts`) answers 401 for that value without a valid admin token, which `baseQueryWithReauth` treats like any other 401 — silent refresh if the refresh token is still good, redirect to `/admin/login` if not. Every other status value (`Draft`, `Archived`, no param) still degrades silently to `Published` for a non-admin caller, unchanged — that is the intended B3 behavior, not a gap.
- Only `proxy.ts` and the read filters enforce access. Controllers do not re-check on writes (only the media upload does): see CP-5.

---

## Security (priority 1)

### Google OAuth flow
- [x] Authorization-code flow; the code is exchanged server-side with `GOOGLE_CLIENT_SECRET` (never sent to the browser).
- [x] Secrets are not logged; a failed login is logged through `logger` with the error message only.
- [x] `state` and PKCE (S256) protect the flow (fixed 2026-09-23, see "Fixed in code" → OAuth): the server keeps them in a single-use HttpOnly cookie and checks them when Google sends the user back.
- [x] The ID token is verified against Google's keys (signature, issuer, audience = `GOOGLE_CLIENT_ID`, expiry) and must carry `email_verified === true`.
- [x] The redirect address is fixed on the server (`NEXT_PUBLIC_APP_URL` + `/admin/login`); the client sends only `code` and `state`.
- [x] `GOOGLE_CALLBACK_URL` was a required env var but was **not used** anywhere; dropped from `requiredEnvVars` in `env.ts` 2026-09-28 (32 required variables now). `config/local.env`'s placeholder line is harmless if left in place.
- **(you)** Google Cloud Console: authorized redirect URI must be exactly `https://<domain>/admin/login` (the localhost one can stay for development); OAuth consent screen status. `NEXT_PUBLIC_APP_URL` must be the same origin, as a build variable.

### Email allowlist
- [x] `ADMIN_EMAILS` (env, case-insensitive) is checked at the exchange step; an unlisted email gets 401 and no session.
- [x] **Fixed 2026-10-02.** The allowlist used to be checked only at the exchange step; `proxy.ts` and `getUserId()` trusted any validly signed JWT afterward (`getUserId` only confirmed the user row exists), so removing an email from `ADMIN_EMAILS` had no effect until the holder's refresh chain expired (up to 7 days). The access token now carries `email`, and `verifyAdminToken()` (`utils/jwt.ts`) re-checks it against the current `ADMIN_EMAILS` on every request and on every refresh rotation (the family is revoked and refresh answers 401 if the email is no longer allowed). Tokens issued before this change have no `email` claim and are rejected, but upgrade transparently through one ordinary refresh instead of a hard logout (the "premature refresh" heuristic below specifically treats such a token as not suspicious).
- [x] **Fixed 2026-10-01.** `POST/PUT/DELETE /api/v1/users` let any authenticated JWT create/edit/delete a user row (no role model, and zero consumers in the admin UI); removed entirely, along with `saveUser`/`deleteUser` in the service/controller/`IUserService` and the now-unused `userSchema`. Only `GET /users` and `GET /users/:id` remain, same JWT gate as before.

### Sessions, cookies, CSRF
- [x] Access JWT (HS256, 15 min) and refresh token (random 40 bytes, stored **hashed**, 7 days), rotated on every refresh, with reuse detection that revokes the token family.
- [x] Cookies: HttpOnly, SameSite=Strict, refresh path scoped to `/api/v1/auth`; `Secure` when `NODE_ENV=production` (dev-login always sets `secure:false`, and refuses to run when `NODE_ENV=production`).
- [x] CSRF: SameSite=Strict + JSON bodies; no cross-site form path.
- [x] The login `oauthState` cookie is HttpOnly, SameSite=Lax (the browser returns from Google by a cross-site redirect), path `/api/v1/auth`, 10 minutes, deleted on every exchange attempt; `Secure` when `NODE_ENV=production`.
- [x] Default JWT secret fallback was removed (throws if missing).
- [ ] "Premature refresh" heuristic (`auth/refresh/route.ts`) revokes the family when refreshing with >2 min of access-token life left. Parallel tabs or retries can log the admin out; consider removing it.
- [x] **Fixed 2026-10-01.** Expired `token_sessions` rows are now purged opportunistically on every successful login/refresh (`TokenRepository.deleteExpired()`), deleting only rows past `expiresAt`. A still-unexpired `isUsed` row is deliberately left alone: the refresh route's reuse detection (replaying an already-rotated-out token revokes the whole `token_family`) depends on that row still being there, so purging it early would silently downgrade a theft signal to a plain 401.
- [ ] Placeholder password string is stored for admin rows; `users.password` should be nullable or a real hash, since the password login flow does not exist. The only remaining code path that sets it is `auth/google/exchange/route.ts`'s auto-provisioning (`POST/PUT/DELETE /api/v1/users` and `UserService.saveUser`/`deleteUser` were removed 2026-10-01 as unused, so the brief manual-creation path is gone) — the underlying "no real password flow" design gap is unchanged.

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
- [x] **Fixed 2026-10-02.** Admin-only writes other than uploads now have a rate limit too (`RATE_LIMITS.adminWrite`, 300 per minute per client address) — deliberately loose, sized only to catch a leaked token or a runaway script, not to throttle normal 1-2 person admin work (confirmed: 300 requests pass, the 301st gets 429).

### Secrets management
- [x] `.env*` and `config/local.env` are git-ignored; `config/local.env` was never committed; no Google client-secret pattern (`GOCSPX`) in git history.
- [x] `config/test.env` is tracked but contains only mock values.
- [ ] `docker-compose.yml` hardcodes dev passwords (`postgres_local_password`, `minio_admin_password`). Never reuse them in production.
- [x] **Fixed 2026-10-02.** `seeds/initial-data/users.json` committed an admin email and a password-shaped value (always just the standard placeholder, never a real credential, but looked like one and had no loader anywhere); the file was deleted. The admin row is still auto-provisioned on first Google login (`auth/google/exchange/route.ts`), unaffected.
- **(you)** Generate a strong `JWT_SECRET`, DB and MinIO credentials in Coolify's secret store.

### Input validation
- [x] Every controller validates request bodies with Zod (`common/validation/schemas.ts`).
- [x] Uploads: type allowlist (JPEG/PNG by declared MIME), size limit `NEXT_PUBLIC_MAX_FILE_SIZE_MB`, and images are re-encoded by `sharp` (metadata/EXIF dropped by default).
- [x] **Fixed 2026-09-28.** `StorageService.uploadImage` used to branch its encoding and build the stored extension/`Content-Type` from the client-declared MIME and filename; it now calls `sharp(buffer).metadata()` first and uses the real decoded `format` (only `jpeg`/`png` accepted) for all three. A file sharp cannot decode, or decodes to an unsupported format (including a spoofed type, e.g. a WebP sent as `image/png`), is a `ValidationError` (400) instead of an uncaught exception from inside the resize/encode step. Checked with four scripted cases: a real PNG under a `.txt` filename (accepted, stored as `.png`), garbage bytes claiming to be PNG (rejected, 400), a real decoded JPEG (accepted as `.jpg`), and the full `mediaService.uploadAndSaveMedia` → MinIO path (stored `Content-Type` confirmed `image/png`).
- [x] **Fixed 2026-10-02.** The number of files in one multipart upload request is now capped (`MAX_FILES_PER_UPLOAD`, optional env var, default 50) — a request with more is rejected with a `ConflictError` before any file is processed. Files are still processed sequentially within that cap (unchanged, not a problem at 50).
- [ ] **New finding, 2026-10-02.** Next's own `experimental.proxyClientMaxBodySize` is not set in `next.config.ts`, so it defaults to **10 MB**: Next buffers and silently truncates the body of every request that passes through `proxy.ts` (i.e. nearly every route, not just uploads) before any application code — including `NEXT_PUBLIC_MAX_FILE_SIZE_MB`'s own check — runs. Confirmed by testing: a single 12 MB file, and two 8.7 MB files in one request, both get truncated mid-file and fail with a raw 500 ("Failed to parse body as FormData") instead of the intended clean "file too large" error. Because `NEXT_PUBLIC_MAX_FILE_SIZE_MB` is also `10`, a file right at that boundary risks this 500 instead of the clean 409, since multipart framing overhead pushes the real body slightly past 10 MB even for a file just under the configured cap. Not hit in practice today — the admin media library always uploads one file per request (`admin/media/page.tsx`), and the owner's real photos are 5-7 MB — but it is a real, reproducible gap for any file near/over ~10 MB. Fix: set `proxyClientMaxBodySize` to `NEXT_PUBLIC_MAX_FILE_SIZE_MB` plus headroom for multipart overhead — a `next.config.ts` change, planned separately (`CHANGE-PLAN.md` CP-16), not made without the owner's go-ahead.
- [x] **Fixed 2026-10-02 (second round).** A malformed JSON body now returns a clean `ValidationError` (400): new `parseJsonBody()` (`utils/validateRequest.ts`) wraps `request.json()` at all 11 call sites across 9 controllers, converting a `SyntaxError` instead of letting it bubble to a generic 500 (`categoryController.reorderCategories`'s separate `z.array(...).parse(...)` call had the same leak for a `ZodError`, now routed through `validateRequest` too). A non-UUID `:id` now returns a clean 404 instead of a raw `invalid input syntax for type uuid`: every repository's `getById`/`getByIds`/`delete` (the base class, plus the four repositories that override them — `Category`, `Post`, `Comment`, `SystemText`) short-circuits on a non-UUID input. `status` and `search` query values are unaffected by this round and remain unvalidated against an enum/pattern (`page`/`limit` were already sanitized and capped in `getPaginationParams` since 2026-09-23).
- [x] **Fixed 2026-10-01.** `createComment` now checks `postId` exists before inserting (`NotFoundError`, 404) instead of letting the real `comments.post_id` FK violation surface as an uncaught 500.
- [x] **Fixed 2026-10-02.** `createComment` now also checks `replyId` when one is given; unlike `postId` it has **no FK constraint at all** in the schema (`comments.reply_id`, see "Services bypass repositories" / self-referencing FKs below), so a bogus value used to be silently stored instead of rejected.

### SQL injection
- [x] All queries go through Drizzle; the raw `sql` fragments use bound parameters (`ILIKE ${...}`), and `sql.identifier` is used for column names.
- [x] **Fixed 2026-10-01.** `%`, `_` and `\` in `search` are now escaped before being wrapped in the `ILIKE` pattern (`postRepository.ts`), so a literal wildcard character in a search term is matched literally. This was a correctness issue, not a safety one — parameters were always bound.

### XSS
- [x] No `dangerouslySetInnerHTML` in the codebase; React escapes user text (comments, titles).
- [x] Security headers added in `next.config.ts`'s `headers()` (2026-09-28): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/microphone/geolocation denied), and a `Content-Security-Policy`. `img-src` includes the `S3_PUBLIC_URL` origin (read from `process.env` when `next.config.ts` loads); `style-src`/`font-src`'s Google Fonts allowance predates `next/font` (fonts are now self-hosted via `next/font/google`, fixed 2026-10-05, so that CSP allowance is no longer needed and could be dropped if the CSP is tightened later). Checked with a headless browser on the public homepage and `/admin/login`: no CSP console violations.
- [ ] The CSP is a baseline, not a strict one: `script-src`/`style-src` keep `'unsafe-inline'` because the App Router streams RSC payloads through inline `<script>` tags and framer-motion sets inline `style` attributes, and neither is nonce-based today. A stricter CSP needs a per-request nonce generated in `proxy.ts` and threaded through `next/script`/`<style>` — bigger change, not done.
- [ ] No HSTS yet (no HTTPS locally); add it once the app is behind Coolify's TLS.

### Dependency vulnerabilities

**Fixed 2026-10-05** (one-off exception: the owner explicitly authorized Claude to run this upgrade directly, in chat, rather than running it themselves as `CHANGE-PLAN.md` CP-2 originally specified; `npm audit fix`/`--force` stayed off-limits, enforced by `.claude/settings.json`'s `deny` list regardless). `next` 16.2.6 → 16.3.8, `sharp` 0.34.5 → 0.35.4, `eslint-config-next` 16.2.6 → 16.3.8, `shadcn` moved from `dependencies` to `devDependencies`. The original plan targeted `next@16.3.5`; by the time this ran, `16.3.5` itself had gained its own critical advisory (RCE in `next/og`'s `ImageResponse`, published after 2026-09-23) — not used anywhere in this codebase, but the fix was a trivial same-minor patch bump (16.3.8) so it was taken anyway rather than relying on "doesn't apply." `npm audit --omit=dev`: **0 critical, 0 high, 5 moderate** — down from 1 critical/9 high/7 moderate/3 low on 2026-09-19 (full-tree `npm audit`, not omit-dev, was 28 on 2026-09-23; moving `shadcn` to `devDependencies` alone dropped the full-tree count from 33 to 23 before `shadcn` itself was reinstalled as a dev dependency, bringing it back to 26). Outputs: `.claude/command-output/npm_audit_omit_dev_2026-10-05.json`. Verified: `tsc --noEmit`/`next build` clean (same 28 routes); a scripted end-to-end check against the local dev DB + MinIO through `mediaService.uploadAndSaveMedia` (not just `sharp` in isolation) — a real PNG and a real JPEG both decoded, resized to the existing 1000px/320px bounds, re-encoded, uploaded, fetched back over HTTP and re-decoded successfully, orientation detection unchanged, a garbage/undecodable file still rejected with the existing `ValidationError`, and both test rows/objects were cleaned up afterward (confirmed gone from MinIO, not just the DB). **Not verified by a script, still needs the owner:** a real Google login and a real browser-driven image upload — Google OAuth can't be exercised without a real account in a real browser.

The 5 remaining moderate findings, all already known and accepted:
- **`baseline-browser-mapping`** (new as of this round): a direct dependency of `next` itself (not something this project's own `package.json` can version independently), used by Next's internal build tooling (browserslist data), not reachable through any running request path.
- **`decode-uri-component`/`stream-json` via `minio@8.0.7`** (`query-string` chain): unchanged from before — the audit's own suggested fix is `minio@7.1.3`, a downgrade, which is worse than the risk it fixes. The client only talks to this project's own MinIO instance.

**Build/dev only, now actually out of the runtime tree:**
- [x] **Fixed 2026-10-05.** The `shadcn` CLI (and its `@modelcontextprotocol/sdk` → `hono`/`express`/… chain, plus `@babel/core`/`browserslist`/`ts-morph` → `brace-expansion`/`cosmiconfig` → `js-yaml`) is now in `devDependencies`. `globals.css` still imports `shadcn/tailwind.css` at build time, confirmed unaffected (`next build` passes, same styling). Package name is still `next-temp`.

<details>
<summary>2026-09-19 analysis (superseded 2026-10-05, kept for history)</summary>

`npm audit` (2026-09-19): 20 findings (1 critical, 9 high, 7 moderate, 3 low). On 2026-09-23 it reports 28 (1 critical, 10 high, 14 moderate, 3 low): `rate-limiter-flexible` (added that day, no dependencies, in no advisory) is not involved; the 8 extra package names are dev tooling with newly published advisories (`vitest`, `@vitest/ui`, `@vitest/mocker`, `esbuild`, `@esbuild-kit/*`, `drizzle-kit` via esbuild, and `undici` via `jsdom`; `npm ls undici --omit=dev` is empty). Output: `.claude/command-output/npm_audit_2026-09-23.json`.

- **`next@16.2.6`, critical, 11 advisories, fixed in 16.3.5.** Includes a Middleware/Proxy bypass (Turbopack + single locale), Image Optimization API issues (SVG DoS, AVIF RCE; `/_next/image` is on by default and `next/image` is used in 2 files), and several Server Actions / rewrites / Windows-only items that do not apply here (no `"use server"`, no rewrites in `next.config.ts`, Linux). The proxy-bypass advisory (GHSA-6gpp-xcg3-4w24, patched in 16.2.11) requires Turbopack and a single `config.i18n.locales` entry; this app has no `i18n` block, so it most likely does not apply (CP-1, 2026-09-19), but the upgrade is still needed for the other advisories.
- **`sharp@0.34.5`, high** (libvips/libheif CVEs, fixed in 0.35.4, flagged as a breaking change). It processes every uploaded image (admin-only path).
- **`minio@8.0.7`, moderate** via `stream-json` / `query-string` / `decode-uri-component` (DoS on crafted input). The audit's suggested fix installs `minio@7.1.3`, which is a downgrade: do not accept it.
- [x] **`rate-limiter-flexible@11.2.1`** (added 2026-09-23): ISC, no dependencies, no install scripts, ships its own types, in no advisory. One maintainer.

</details>

Also add defense in depth: verify the JWT inside the API layer (controllers), not only in `proxy.ts` (CP-5, now unblocked — the Next upgrade it was waiting on is done); today only the media upload does.

---

## Deployment (priority 1)

### Docker Compose / build
- [x] Dev compose works as local infrastructure: postgres 16, pinned MinIO release, pgweb; `restart: always`; data persists in `./.docker/*` bind mounts.
- [ ] Not production-ready as is: no `app` service, no Dockerfile / `.dockerignore`, no healthchecks, hardcoded creds, pgweb (8081) and the MinIO console (9001) published on host ports. Use compose only for local development; in Coolify provision Postgres/MinIO as managed resources or a separate production compose.
- [x] `next build` succeeds (2026-09-23: Next 16.2.6, Turbopack, 28 pages, TypeScript step passes, `Proxy` recognized). All app routes are dynamic (`ƒ`, including `/sitemap.xml`); only `/icon.png` and `/robots.txt` are static. The build needs the full env but no database: it also passes with an unreachable `DB_URI` (checked 2026-09-23), which is what a Docker build has. Use `bash scripts/run.sh build` (the script is not executable).
- [ ] Dockerfile plan: multi-stage build, `output: "standalone"`, `NEXT_PUBLIC_*` as build args, secrets as runtime env, a migration step before start, and a base image that supports `sharp`.
- [ ] `next.config.ts` has security headers and (since 2026-10-02) an `images` block, but no `output: "standalone"` yet — add it for a smaller image. `images.remotePatterns` (added 2026-10-02 for the public project gallery) allowlists the `S3_PUBLIC_URL` host; a dev-only `images.dangerouslyAllowLocalIP` was also needed, since Next 16 refuses to optimize an image whose host resolves to a private IP (which `localhost` — the local MinIO address — always does), guarded off in production where `S3_PUBLIC_URL` will be a real public domain.
- [ ] Build needs the full env (`env.ts` throws at import when any of the 32 required variables is missing); decide which variables are build-time vs runtime in Coolify. `NEXT_PUBLIC_*` values are inlined at build.
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
- [ ] 34 of 40 `console.*` calls still bypass it (6 fixed 2026-10-02, second round; the rest are in client components where winston can't run — see "Code quality"); there is no request logging and no error tracking.
- [ ] Uptime check on `/` and the health endpoint; disk alerts for the volumes.

---

## Code quality (priority 2)

- [x] `tsconfig` `strict: true`; zero `@ts-ignore` / `eslint-disable`.
- [ ] About 280 lines with `any` / `as any` (318 `no-explicit-any` lint errors; controllers use `catch (error: any)`, services take `body: any`), against the project's "zero `any`" rule. New code (rate limiter, storage, Google login) uses `unknown` and explicit types.
- [x] **Fixed 2026-10-02 (second round).** Duplicated token-issuing code in three auth routes: new `issueSession(userId, email, tokenFamily?)` (`utils/authSession.ts`) mints the access/refresh token pair, stores the session and sets both cookies in one place; all three routes (`google/exchange`, `dev-login`, `refresh`) call it instead of each having their own copy. Not a full `AuthService` class — the remaining per-route logic (OAuth code exchange, theft-detection heuristics, the allowlist re-check) is genuinely route-specific, not copy-pasted, so it stays in the routes.
- [x] **Fixed 2026-10-02 (second round).** Services bypass repositories: `CategoryService.deleteCategory` and `MediaService.deleteMedia` used to run their own `drizzleDatabase.getDb().select(...)` queries; they now call new repository methods (`CategoryRepository.countChildren`, `PostRepository.countByCategory`/`countByPoster`/`countGalleryUsage`), each guarded against a non-UUID input the same way `getById` is. Business behavior unchanged (regression-tested against real dev-DB rows: category-has-children, media-is-poster, media-in-gallery all still 409).
- [ ] Self-referencing FKs are missing at the database level (`categories.parent_id`, `comments.reply_id`) — no `ON DELETE`/existence guarantee from Postgres itself, only app-level checks. **Narrowed 2026-10-05**: `CategoryService.saveCategory` used to validate `parentId` only for self-reference and cycles, never that it actually exists — a category could be saved pointing at a nonexistent parent id with no error. That specific gap is now closed with an app-level existence check (no migration). The real FK constraint itself (the DB-level backstop, with an `ON DELETE` policy — `RESTRICT` for categories to match the existing app-level 409 on delete-with-children, `CASCADE` for comments to match the existing manual cascade-delete-replies code) is unchanged and still needs a migration — discussed with the owner, not yet approved (`CHANGE-PLAN.md` CP-22).
- [ ] `meta.totalItems` is wrong (page size), `GET /collections/:id/posts` is double-wrapped.
- [ ] Repeated per-controller `try/catch`; a `withErrorHandling(handler)` wrapper would remove it.
- [ ] `npm run lint` fails (2026-09-23): 418 problems (345 errors, 73 warnings), down from 425 (348 errors, 77 warnings) on 2026-09-19 — **not re-run since** (no dependency change, so the number is stale by the lint-affecting edits below; re-run `npm run lint` for a current count). Errors: 318 `no-explicit-any`, 19 `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect"), 1 `react-hooks/immutability` (a function used before its declaration), 3 `no-require-imports` (`pull-system-texts.js`), 3 `no-empty-object-type` (empty repository interfaces), 1 `prefer-const`. Warnings: 57 unused vars, 8 `exhaustive-deps`, 7 `no-img-element` (now 6, the public gallery was fixed 2026-10-02), 1 hooks/library. Lint cannot be a CI gate until this is cleaned or scoped. Saved: `.claude/command-output/lint_2026-09-23.json`.
- [x] **Partly fixed 2026-10-02 (second round).** 6 of the 40 `console.*` calls that bypass the logger are now `logger` calls: `sitemap.ts`, `projects/[slug]/layout.tsx`, `utils/slug.ts`, `tagService.ts`, and the two `[THEFT DETECTION]` warnings in `auth/refresh/route.ts`. The remaining ~34 are all inside `"use client"` components (admin pages, `CommentSection.tsx`, `combobox.tsx`): winston (`src/modules/logger`) is a Node-only library and cannot run in the browser, so these need a separate client-safe logging decision, not a 1:1 swap — tracked in `CHANGE-PLAN.md` CP-18.
- [x] `npx tsc --noEmit` prints nothing (0 errors); the TypeScript step of `next build` also passes.

## Testing (priority 3)

- [ ] Unit: none. `vitest` and testing-library are installed but there is no config and no test file.
- [ ] Integration (API): none. `test:api` (Playwright), `docker-compose.test.yml`, `config/test.env` exist, but there is no `playwright.config` and no specs.
- [ ] E2E for the auth flow: none.
- [ ] `config/test.env` has no `JWT_SECRET`, which `env.ts` requires; add a mock value before the first test run (CP-4). It has `S3_PUBLIC_URL` since 2026-09-23 (added by the user).
- Highest-value first tests: proxy auth matrix (which method+path needs a token), token rotation/reuse detection, category cycle guard, media in-use delete guard, post status visibility.

## Performance (priority 3)

- [ ] Images: 6 raw `<img>` remain (admin lists, drag-and-drop/crop widgets); `next/image` is used in 3 files (login page, home page, and the public project gallery, fixed 2026-10-02 — `next.config.ts` gained `images.remotePatterns` for the MinIO host). Stored thumbnails are ≤320 px, and the original is capped at 1000 px.
- [x] **Fixed 2026-10-05.** Bundle: `import * as LucideIcons from "lucide-react"` in the public project page defeated tree-shaking; replaced with a small curated set of explicitly named icon imports (`Link`, `Globe`, `Phone`, `MessageCircle`) merged into the existing `react-icons/fa` `ICON_MAP`, with `Link` as the final fallback. Every icon name in the currently configured `NEXT_PUBLIC_SOCIAL_LINKS` (`pinterest`, `telegram`, `instagram`, `vk`, `email`) was already covered by `ICON_MAP`, so nothing visible changes today — only a future unrecognized icon name now falls back to a generic icon instead of a dynamic any-string lookup across the whole Lucide set.
- [x] **Fixed 2026-10-05.** Fonts via CSS `@import` from Google (blocking, third-party): now loaded through `next/font/google` (`Inter`, `Playfair Display`; same subsets `latin`+`cyrillic`, same weight range and italic style as the original `@import` URL), self-hosted at build time — 0 runtime requests to `fonts.googleapis.com`/`fonts.gstatic.com`, confirmed with a headless-browser check (computed `font-family` resolves correctly on `font-sans`/`font-heading` elements, no visual change in a before/after screenshot comparison).
- [x] DB: 17 btree indexes on FKs/status; list queries use `getListRelations()` (partial select) instead of full relations.
- [x] **Partly fixed 2026-10-05.** DB: `search` now also matches `description` (same `::text ILIKE` pattern, OR'd with the existing `title` condition) — still no GIN/`pg_trgm` index, so it remains a sequential scan on both columns.
- [x] **Fixed 2026-10-05.** Every page is still dynamic (`headers()` in the root layout), but the `system_texts` read (up to 2000 rows) no longer hits Postgres on every request: `SystemTextService.getAllSystemTexts` wraps the repository call in `unstable_cache` (tag `system-texts`, no time-based expiry — relies entirely on tag invalidation), and `saveSystemText`/`deleteSystemText` call `revalidateTag("system-texts", { expire: 0 })` right after writing. Not Next 16's new Cache Components (`"use cache"`/`cacheLife`) — `next.config.ts` doesn't set the `cacheComponents` flag project-wide, and that's a bigger, separate decision; `unstable_cache` (the pre-16 API, still supported) is the right-sized tool here. Found along the way: this Next version's `revalidateTag` now requires a second `profile` argument (the single-argument form is deprecated). Verified with temporary instrumentation on a `next build && next start` server: repeated identical requests to the API route and to the public homepage each produced exactly one real DB query; an admin edit (reverted after the test) triggered exactly one more query on the next read of each distinct cache-key shape, and the rendered homepage reflected the new content immediately.
- [ ] Public pages are client-rendered (RTK Query), so post content is not in the initial HTML. Consider server-fetching the first page of posts and the project page for SEO.
- [ ] No HTTP caching headers for public GETs.
- [x] **Fixed 2026-10-05.** `DrizzleDatabase` used to cache its singleton in a class static field; `next dev`'s Fast Refresh could re-evaluate the module and spin up extra connection pools (`postgres` default max 10 each). Now cached on `globalThis` instead.

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
| `npx tsc --noEmit` (2026-09-28, run by Claude) | empty output, 0 errors | "Code quality" |
| `bash scripts/run.sh build` (2026-09-28, run by Claude) | passes (28 pages) | "Deployment", B12 |
| `npm audit --omit=dev` (2026-10-05, run by Claude, one-off authorized exception to CP-2) | 0 critical, 0 high, 5 moderate (all already-known/accepted) | B10, "Dependency vulnerabilities" |
| `npm run lint` (2026-10-05, run by Claude) | 420 problems (349 errors, 71 warnings) | "Code quality" |
| `bash scripts/run.sh build` (2026-10-05, run by Claude) | passes (28 pages), after `next`/`sharp`/`eslint-config-next` upgrade | "Deployment", B10 |

## Decisions and status

- **Coolify:** not set up yet. The chosen approach is a **Dockerfile** (B8 stays open until it exists).
- **Public MinIO URL:** not chosen (nothing is deployed, no domain yet). The code no longer depends on the choice: the required `S3_PUBLIC_URL` is set when the address is known (`CHANGE-PLAN.md` CP-8); locally it equals `S3_ENDPOINT`. It must be set before the first upload in production, because it is stored in every `media` row.
- **`NEXT_PUBLIC_DEV_MODE`:** nothing is deployed. When the pipeline exists it must be `false` in the build variables (B6). Since 2026-09-19 dev-login also refuses `NODE_ENV=production`, a second guard.
- **Google OAuth:** login by email works locally without dev mode (checked by the user on 2026-09-23 after the `state`/PKCE change). When a domain exists, register `https://<domain>/admin/login` as an authorized redirect URI, set `NEXT_PUBLIC_APP_URL` to that origin, and keep the localhost URI for development.

## Still needed from you (later, one step at a time)

Tracked in `CHANGE-PLAN.md` as CP-4 (CP-1 was answered on 2026-09-19; CP-2's dependency upgrade itself is done as of 2026-10-05, see "Dependency vulnerabilities" — only the manual-verification half remains); CP-8 (public MinIO address) waits for a domain and a server.

1. A real Google login and a real browser-driven image upload, now against `next@16.3.8`/`sharp@0.35.4` (CP-2's manual-verification step — Google OAuth can't be exercised by a script; the upload path itself was already checked end-to-end programmatically against the real MinIO instance).
2. Check the B1–B6 fixes by hand, send the build and lint output, and decide about a mock `JWT_SECRET` in `config/test.env` (CP-4).

Code changes so far: the B1–B6 fixes (2026-09-19); rate limiting with the `limit` cap, the dynamic sitemap, `S3_PUBLIC_URL` with `ensureBucket()`, and the Google login hardening (2026-09-23); the `next`/`sharp`/`eslint-config-next` dependency upgrade and `shadcn` → `devDependencies` (2026-10-05, one-off authorized exception to the usual "owner runs dependency upgrades" rule), in `src/` plus `package.json`/`package-lock.json`. No migration was changed; `config/test.env` got an `S3_PUBLIC_URL` line from the user. Everything else in this file is a recommendation.

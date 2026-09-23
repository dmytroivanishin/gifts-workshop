---
name: portfolio-security-audit
description: Security audit of the Portfolio app: Google OAuth and JWT sessions, the proxy.ts auth gate, API exposure, uploads, headers, secrets. Use before a release, after touching auth/proxy/upload code, or when asked for a security check, audit or pentest-style review of the code.
argument-hint: "[--focus auth|api-exposure|uploads|headers|all]"
allowed-tools: Read Grep Glob Bash(git log *) Bash(git grep *)
---

# Portfolio Security Audit

Read-only audit of the code as it is today. The checklist comes from `PRODUCTION-READINESS.md` (Security) plus the actual code in `src/proxy.ts`, `src/app/api/v1/auth/**`, `src/utils/{auth,jwt,apiResponse,googleOAuth,rateLimit}.ts` and `src/modules/storage`. Note: `.agents/rules/system_rules.md` is an AI-collaboration process document, not a security document, so it is not a source here; `.agents/rules/backend.md` supplies only the intended auth design (short-lived access token, refresh token in an HttpOnly Secure SameSite=Strict cookie, single-admin allowlist).

## Trigger words

security audit, security review, is this safe, auth review, OAuth, JWT, cookies, upload safety, secrets, hardening, аудит безопасности, проверь безопасность.

## Parameters

Arguments received: `$ARGUMENTS`

- `--focus auth|api-exposure|uploads|headers|all` (default: `all`). `api-exposure` delegates to `.claude/skills/portfolio-api-exposure-check/SKILL.md`.

Rules of engagement: do not run network commands or dependency commands (`npm audit`, `npm install`); dependency findings come from `portfolio-dependency-audit` with output supplied by the user. Never print secret values: when reading `config/*.env`, list variable names only (`sed 's/=.*//'`).

## Process

1. **Baseline.** Read `PRODUCTION-READINESS.md` (blockers B1–B11, Security section) and `CHANGE-PLAN.md`. Treat each listed item as *claimed*; re-verify it in the code and report `still open`, `fixed` or `changed`. Then look for problems not on the list.
2. **auth**
   - Google flow (hardened 2026-09-23; check that none of it was weakened): authorization-code, code exchanged server-side with `GOOGLE_CLIENT_SECRET`; `state` (random, single-use `oauthState` cookie compared with `statesMatch`) and PKCE S256 (`code_verifier` sent in the token request) in `utils/googleOAuth.ts` and `auth/google/{start,exchange}/route.ts`; the redirect address is fixed on the server (`googleRedirectUri()` = `NEXT_PUBLIC_APP_URL + "/admin/login"`) and the client sends only `{code, state}`; the ID token goes through `verifyGoogleIdToken` (`jwtVerify` against Google's keys: RS256, issuer, `aud === GOOGLE_CLIENT_ID`, expiry) and needs `email_verified === true`. Red flags: a client-supplied redirect, `decodeJwt` instead of `jwtVerify`, a skipped or non-single-use state check.
   - Allowlist: `ADMIN_EMAILS` is checked at exchange time only; `proxy.ts` and `getUserId()` verify signature/expiry, not email or role. Check whether any new code assumes more.
   - Tokens: HS256 access JWT (15 min), refresh token stored hashed, rotation, reuse detection revoking the `token_family`, the "premature refresh" heuristic, purge of old `token_sessions`. `JWT_SECRET` must be in the env whitelist and have no fallback.
   - Cookies: `accessToken` (path `/`) and `refreshToken` (path `/api/v1/auth`), HttpOnly, SameSite=Strict, `Secure` in production; `dev-login` must not be able to set `secure:false` in production. The login-only `oauthState` cookie is HttpOnly, SameSite=Lax (the browser returns from Google by a cross-site redirect), path `/api/v1/auth`, 10 minutes, deleted on every exchange attempt.
   - `dev-login` and `NEXT_PUBLIC_DEV_MODE`: build-time flag; the route must also be refused when `NODE_ENV === "production"`.
   - CSRF: SameSite=Strict + JSON only; look for any new form-encoded or `GET`-with-side-effects route.
3. **api-exposure.** Apply the `portfolio-api-exposure-check` process. The recurring root cause: `src/proxy.ts` decides mostly by HTTP method. It gates `POST/PUT/PATCH/DELETE` (plus `/admin/*` pages) and, since 2026-09-19, every method on `/api/v1/users/**` and `/api/v1/admin/**` (the `isAdminOnlyResource` pattern), so every other `GET` is public and must be safe by construction (unpublished posts are filtered in code through `utils/postVisibility.ts`, repositories return field allowlists). The routes under `/api/v1/auth/` are open at the proxy and must check for themselves. Also check that a mutation reaching a controller without the proxy (direct call, matcher gap) would still be refused: the proxy is the only guard, so recommend a JWT check in controllers as defense in depth.
4. **uploads** (`POST /media`, `MediaService.uploadMultiple`, `StorageService`): type validated by magic bytes and not by the client-declared MIME; extension derived from the detected format, not the filename; per-file and total size limit before the body is buffered; file-count cap; `sharp` errors mapped to 4xx; object names contain no user-controlled path parts; bucket is public-read for the objects only; no presigned URL exposure; bucket credentials only from env.
5. **input validation and errors.** Every controller validates bodies with Zod; query/path params (`status`, `limit`, `page`, `search`, non-UUID ids) are validated too; malformed JSON returns 400; `limit` is capped; `sendError` in `src/utils/apiResponse.ts` returns a generic message for non-`BaseError` failures instead of raw `error.message`; no stack traces in responses.
6. **SQL and XSS.** Drizzle only; any `sql` template must use bound parameters and `sql.identifier` (grep `sql\`` and `sql.raw`); `%`/`_` escaping in `ILIKE`. No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no unsanitized URLs in `href`/`src`. Outbound `fetch` from server code (for example `translate.googleapis.com` in `src/utils/slug.ts`) must never receive secrets or unvalidated hosts.
7. **headers.** `next.config.ts` and the reverse proxy: `Content-Security-Policy` (Google Fonts via CSS `@import` must be allowed, or moved to `next/font`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `X-Frame-Options`/`frame-ancestors`. No CORS headers configured is the intended same-origin setup.
8. **rate limiting.** In place since 2026-09-23 (`proxy.ts` + `utils/rateLimit.ts`, `rate-limiter-flexible`, in memory): `/api/v1/auth/*` 20 per minute, public `POST /posts/:id/comments` 5 per 10 minutes, `POST /media` 30 per minute, and `limit` capped at 100. Check that these still hold and that any new public or expensive route has a rule in `resolveRateLimitRule`. Known limits to report, not to re-discover: ordinary GETs are not limited, counters are per process (several instances need Redis or Traefik), and the client address is the last `X-Forwarded-For` entry, which assumes Traefik is the only proxy in front (behind Cloudflare every visitor would share one key).
9. **secrets.** `git ls-files` shows no `.env*` except the mock `config/test.env`; `git log -S` for key-like patterns (`GOCSPX`, `-----BEGIN`); compose credentials are dev-only; `seeds/initial-data/users.json` carries an admin email and a password value; nothing sensitive in `NEXT_PUBLIC_*`.
10. **dependencies.** Do not run anything. Point to `portfolio-dependency-audit` and to CP-1 / CP-2 in `CHANGE-PLAN.md` (the Next proxy-bypass advisory GHSA-6gpp-xcg3-4w24 is unconfirmed while CP-1 is open).

## Output

1. **Executive summary:** release-blocking findings first.
2. **Findings table:** `ID | severity | area | file:line | evidence | recommended fix | status vs. baseline (open / fixed / new)`.
3. **Baseline diff:** which of B1–B11 changed status (B1–B6, B7, B9, B11 and the OAuth hardening are fixed in code; B8 and B10 are open).
4. **Needs your action** (things that cannot be verified from the repo: Google Cloud Console redirect URIs, secret generation in Coolify, backups).
5. Offer to update `PRODUCTION-READINESS.md`; do not edit it unless asked. Never modify `src/`.

## Example usage

```
/portfolio-security-audit
/portfolio-security-audit --focus auth
/portfolio-security-audit --focus uploads
```

---
name: gifts-workshop-api-exposure-check
description: Builds the route × method × access table for /api/v1 and finds public endpoints that return admin-only data, unpublished content or internals. Use after adding or changing any route, controller or proxy rule, before a release, or when asked what is publicly readable.
argument-hint: "[--method GET|all]"
allowed-tools: Read Grep Glob
---

# Gifts Workshop API Exposure Check

The proxy in this repo (`src/proxy.ts`) decides access **mostly by HTTP method**: `POST/PUT/PATCH/DELETE` need a valid `accessToken` cookie, `/api/v1/auth/*` needs no token, and every other `GET` is public. Since 2026-09-19 one path rule is added on top, extended 2026-09-28: every method on `/api/v1/users/**`, `/api/v1/admin/**` and `/api/v1/media/**` also needs a token (`isAdminOnlyResource`). The method-only design had produced four release blockers, B1–B3 fixed 2026-09-19 (still awaiting manual verification) and B12 fixed 2026-09-28 (B1 `GET /users` returning the `password` column, B2 public `GET /admin/comments`, B3 drafts/archived posts readable anonymously, B12 public `GET /media` listing every file including images of unpublished posts). What an anonymous `GET` returns is therefore decided in **two places**: the proxy, and filters in code (posts go through `utils/postVisibility.ts`, the public comments route forces `Approved`). Since 2026-09-23 the proxy also rate limits three route groups per client address (`/api/v1/auth/*`, the public comment `POST`, `POST /media`; `utils/rateLimit.ts`) and answers 429. This skill re-derives the exposure from the code so such cases are caught the moment a route is added. Read-only.

## Trigger words

api exposure, what is public, who can call this endpoint, public GET, access matrix, endpoint audit, route audit, admin data leak, какие эндпоинты публичные, что доступно без логина.

## Parameters

Arguments received: `$ARGUMENTS`

- `--method GET|all` (default: `GET`, because non-GET are gated by the proxy; use `all` to also verify the gate itself and the auth routes).

## Process

1. **Read the gate.** Open `src/proxy.ts` and restate the rules from the code, not from memory: which paths and methods need a token (mutating methods, plus every method under `/api/v1/users` and `/api/v1/admin`), the public exception (currently `POST /api/v1/posts/:id/comments` by regex), what `/api/v1/auth/` skips, the rate-limit rules (`resolveRateLimitRule`) and the `config.matcher` exclusions. If the rules differ from the description above, use the code and say so.
2. **Enumerate routes.** `Glob src/app/api/v1/**/route.ts`. For each file list the exported HTTP methods (`export async function GET|POST|PUT|PATCH|DELETE`).
3. **Classify access** per route × method: `public` (no token, full data), `public, filtered` (no token, but the code narrows the result for anonymous callers: `Published` posts via `resolveStatusFilter` / `visibleToViewer`, comments forced to `Approved`), `token` (proxy checks a valid JWT, signature/expiry only: no email/role check), `open at proxy, self-checked` (routes under `/api/v1/auth/`: read each handler to see what it verifies, including `dev-login` and `NEXT_PUBLIC_DEV_MODE`).
4. **Trace the response of every public route** (with `--method GET`: all `GET`). Follow route → controller → service → repository and write down what is returned:
   - sensitive columns: `users.password`, emails, token/session data;
   - content by status: `posts.status` (`Draft` / `Published` / `Archived`) and `comments.status` (`Review` / `Approved` / `Rejected`): is a default filter applied for anonymous callers, can a caller widen it with `?status=`, and does **every** path that returns the data use it: controllers, route handlers that call a service directly (`collections/[id]/posts/route.ts`), and server-rendered code such as `generateMetadata` and layouts (`projects/[slug]/layout.tsx` once leaked draft titles this way), plus `sitemap.ts`;
   - admin-purpose resources: `/users`, `/admin/*` and `/media` (all three gated by the proxy path rule since 2026-09-28: confirm it still matches every route under them — `GET /media` used to list every file, including images of unpublished posts, until it joined the pattern, B12), `/system-texts` (public area vs admin area texts);
   - field allowlists: repositories that return raw rows (`select()` mapped as is) versus explicit fields (`UserRepository.populate()` returns only `id`, `email`, `name`);
   - nested and alternative access paths to the same data: `/posts/:slug`, `/collections/:id/posts`, `/categories` with posts, comment listings.
5. **Parameter safety on public routes:** `limit` cap (`getPaginationParams` caps it at `MAX_PAGE_SIZE = 100`: check that every list controller goes through the helper instead of parsing `page`/`limit` itself, as `categoryController` did until 2026-09-23), `page`, `search`, `status`, `category` — do they reach Postgres and end in a 500? `:id` non-UUID and malformed JSON are fixed (2026-10-02, second round: an `isUUID` guard on every repository's `getById`/`getByIds`/`delete`, and `parseJsonBody()` in `utils/validateRequest.ts` for every controller that parses a body) — check a new controller uses `parseJsonBody`, not a raw `request.json()`. `sendError` (`src/utils/apiResponse.ts`) returns a generic message since 2026-09-19, so check that it stays generic (no raw `error.message`, no SQL or parameters).
6. **Write access review** (`--method all`): every mutating route is covered by the proxy rule; the public comment `POST` is limited to creating a `Review` comment; nothing writes without validation (`validateRequest`); no route bypasses the proxy through a path the matcher excludes (paths ending in a file extension such as `/x.json` are excluded from the proxy: check that no API route can be reached that way). Controllers do not re-check the token (only the media upload does), so the proxy is the single gate for writes: list the routes a proxy bypass would expose (`CHANGE-PLAN.md` CP-5). Also list the anonymous or expensive routes that have no rate-limit rule (a new public write, an upload, anything login-like should get one).
7. **Compare with the last known state** (`PRODUCTION-READINESS.md` → "Fixed in code", B1–B4, B7 and B12). B1–B4 are fixed since 2026-09-19 but still awaiting manual verification (CP-4); B7 (rate limits, `limit` cap) since 2026-09-23; B12 (`GET /media` gated) since 2026-09-28: report each as `still fixed` or `regressed`, and list anything new.

## Output

1. **Exposure table:**

   | Route | Method | Access | Returns | Sensitive? | Finding |
   |-------|--------|--------|---------|------------|---------|

2. **Findings** (`HIGH` when anonymous callers can read admin data, secrets or unpublished content; `MEDIUM` for unvalidated params and information leaks; `LOW` otherwise), each with `file:line`, evidence and the smallest fix. Typical fixes: add the resource path to the `isAdminOnlyResource` pattern in `proxy.ts`, or check the token in the controller; route status-carrying reads through the visibility helpers (`utils/postVisibility.ts`, `isAdminRequest()` in `utils/auth.ts`); return an explicit field allowlist from the repository; keep the 500 message generic; keep `limit` capped through `getPaginationParams`; add a rule to `resolveRateLimitRule` for a new public or expensive route.
3. **Status vs. B1–B4, B7 and B12** (`still fixed` / `regressed`) and the known gaps (no second auth layer, ordinary GETs not rate limited).

No files are modified. Changes to `src/proxy.ts` or controllers are made only when the user asks.

## Example usage

```
/gifts-workshop-api-exposure-check
/gifts-workshop-api-exposure-check --method all
```

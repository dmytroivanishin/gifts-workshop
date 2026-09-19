---
name: portfolio-api-exposure-check
description: Builds the route × method × access table for /api/v1 and finds public endpoints that return admin-only data, unpublished content or internals. Use after adding or changing any route, controller or proxy rule, before a release, or when asked what is publicly readable.
argument-hint: "[--method GET|all]"
allowed-tools: Read Grep Glob
---

# Portfolio API Exposure Check

The proxy in this repo (`src/proxy.ts`) decides access **by HTTP method, not by resource**: `POST/PUT/PATCH/DELETE` need a valid `accessToken` cookie, `/api/v1/auth/*` is open, and every `GET` is public. That design already produced three release blockers (B1 `GET /users` returning the `password` column, B2 public `GET /admin/comments`, B3 drafts/archived posts readable anonymously). This skill re-derives the exposure from the code so such cases are caught the moment a route is added. Read-only.

## Trigger words

api exposure, what is public, who can call this endpoint, public GET, access matrix, endpoint audit, route audit, admin data leak, какие эндпоинты публичные, что доступно без логина.

## Parameters

Arguments received: `$ARGUMENTS`

- `--method GET|all` (default: `GET`, because non-GET are gated by the proxy; use `all` to also verify the gate itself and the auth routes).

## Process

1. **Read the gate.** Open `src/proxy.ts` and restate the rules from the code, not from memory: which paths and methods need a token, the public exception (currently `POST /api/v1/posts/:id/comments` by regex), what `/api/v1/auth/` skips, and the `config.matcher` exclusions. If the rules differ from the description above, use the code and say so.
2. **Enumerate routes.** `Glob src/app/api/v1/**/route.ts`. For each file list the exported HTTP methods (`export async function GET|POST|PUT|PATCH|DELETE`).
3. **Classify access** per route × method: `public` (no token), `token` (proxy checks a valid JWT, signature/expiry only: no email/role check), `open at proxy, self-checked` (routes under `/api/v1/auth/`: read each handler to see what it verifies, including `dev-login` and `NEXT_PUBLIC_DEV_MODE`).
4. **Trace the response of every public route** (with `--method GET`: all `GET`). Follow route → controller → service → repository and write down what is returned:
   - sensitive columns: `users.password`, emails, token/session data;
   - content by status: `posts.status` (`Draft` / `Published` / `Archived`) and `comments.status` (`Review` / `Approved` / `Rejected`): is a default filter applied, and can a caller widen it with `?status=`;
   - admin-purpose resources: `/users`, `/admin/*`, `/media` internals, `/system-texts` (public area vs admin area texts);
   - nested and alternative access paths to the same data: `/posts/:slug`, `/collections/:id/posts`, `/categories` with posts, comment listings.
5. **Parameter safety on public routes:** `limit` cap (`getPaginationParams` has none), `page`, `search`, `status`, `category`, `:id` non-UUID, malformed JSON: do they reach Postgres and return 500 with a raw `error.message` (`sendError` in `src/utils/apiResponse.ts`)?
6. **Write access review** (`--method all`): every mutating route is covered by the proxy rule; the public comment `POST` is limited to creating a `Review` comment; nothing writes without validation (`validateRequest`); no route bypasses the proxy through a path the matcher excludes (paths ending in a file extension such as `/x.json` are excluded from the proxy: check that no API route can be reached that way).
7. **Compare with the last known state** (`PRODUCTION-READINESS.md` B1–B4). Report each as `still open`, `fixed` or `regressed`, and list anything new.

## Output

1. **Exposure table:**

   | Route | Method | Access | Returns | Sensitive? | Finding |
   |-------|--------|--------|---------|------------|---------|

2. **Findings** (`HIGH` when anonymous callers can read admin data, secrets or unpublished content; `MEDIUM` for unvalidated params and information leaks; `LOW` otherwise), each with `file:line`, evidence and the smallest fix. Typical fixes: gate the `GET` in `proxy.ts` (path-based rule) or check the token in the controller; default `status=Published` for anonymous callers; strip `password` in the repository/service mapping; generic 500 message; cap `limit`.
3. **Status vs. B1–B4.**

No files are modified. Changes to `src/proxy.ts` or controllers are made only when the user asks.

## Example usage

```
/portfolio-api-exposure-check
/portfolio-api-exposure-check --method all
```

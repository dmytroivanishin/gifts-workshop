---
name: gifts-workshop-backend-standards
description: The backend rules and patterns of the Gifts Workshop app as they exist in code (layer templates, response and error contracts, pagination, slug-or-UUID ids, auth, storage, logging). Use when writing or reviewing anything under src/app/api, controllers, services, repositories, utils or modules, or when asked how the backend should be done.
argument-hint: "[--layer controller|service|repository|storage]"
allowed-tools: Read Grep Glob
---

# Gifts Workshop Backend Standards

The rules to follow when writing or checking backend code. Source: `docs/project-plan/backend.md` (moved from `.agents/project-plan/` 2026-10-06) for intent, but it still describes Express, so the **code** is the authority: the concrete patterns below are read from `src/`. Stack decisions (Next.js route handlers, Drizzle + PostgreSQL, `/api/v1` prefix, `PUT` for updates) are settled and are not up for debate here.

## Trigger words

backend standards, how do we write a controller/service/repository, API conventions, response format, error handling, pagination, backend rules, стандарты бэкенда, как писать контроллер.

## Parameters

Arguments received: `$ARGUMENTS`

- `--layer controller|service|repository|storage`: show and check only that layer (default: all).

## Process

Use this as a rulebook: apply it while writing, or read the target code and list deviations. Always open one existing neighbor (the smallest complete example is Color: `colorController.ts`, `colorService.ts`, `colorRepository.ts`, `api/v1/colors/`; the slug variant is Tag) and copy its shape, not its violations.

### Layers

- **Route** (`src/app/api/v1/<resource>/route.ts`, `[id]/route.ts`): `export async function GET|POST|PUT|DELETE`, `params` is `Promise<{ id: string }>` and is awaited, one controller call, nothing else. Kebab-case, plural resource names; `PUT` updates.
- **Controller** (`src/controllers/<x>Controller.ts`): `constructor(private xService: IXService)`, one method per route, one `try { … } catch (error: unknown) { return sendError(error); }`. Body → `validateRequest(schema, raw)` (schemas in `src/common/validation/schemas.ts`, localized fields use `localizedStringSchema`), pagination → `getPaginationParams(request)` (never parse `page`/`limit` by hand: the helper caps `limit` at `MAX_PAGE_SIZE = 100`; heavy lists pass defaults, for example `getPaginationParams(request, 1, 20)` for posts), ids → `resolveId(id, slug => service.getBySlug(slug))`, owner → `getUserId()` then merge `userId` into the payload, reads of an entity that has a draft/status state → apply the anonymous-reader rule (`isAdminRequest()` from `utils/auth.ts`; for posts use `resolveStatusFilter` / `visibleToViewer` from `utils/postVisibility.ts`), missing entity → `throw new NotFoundError(...)`, success → `sendSuccess(data, meta?)`.
- **Service** (`src/services/<x>Service.ts`): `implements IXService` (interface in `services/interfaces.ts`), constructor-injected repository *interfaces*, all business rules (uniqueness, cycle guard, delete guards → `ConflictError` 409), ids via `randomUUID()`, slugs via `utils/slug.ts`. Lists: fetch `limit + 1` rows and return `paginate(rows, { page, limit })` (defaults page 1, limit 20).
- **Repository** (`src/repositories/drizzle/<x>Repository.ts`): `extends DrizzleBaseRepository<T, TPopulated>` and `implements IXRepository`; implement `populate()`; add `getBySlug` when the entity has a slug; list queries load only what the list needs (`PostRepository` has a private `getListRelations()` for this; follow the same idea for any entity with relations); export a singleton `xRepository`.
- **Storage** (`src/modules/storage`): `StorageService.uploadImage` (JPEG/PNG only, size cap from `NEXT_PUBLIC_MAX_FILE_SIZE_MB`, `sharp` resize: original ≤1000 px, thumbnail ≤320 px). Intent: an Adapter/Strategy interface so MinIO can be swapped; new storage code should introduce that interface rather than call the MinIO client from services. Public image URLs are built from `S3_PUBLIC_URL`, never from `S3_ENDPOINT` (the server's own connection address); the bucket is prepared by `ensureBucket()` before the first upload, so do not add another bucket-creation path.
- **Composition root** (`src/modules/core/container.ts`): register every repository, service and controller here; nothing else instantiates them.

### Contracts

- Success: `{ data, meta? }` via `sendSuccess`. Failure: `{ data: {}, error: { code, message, details? } }` via `sendError`. Never hand-build `NextResponse.json` in controllers or routes.
- `meta` from `paginate()`: `{ page, nextPage, prevPage, totalItems }` (`totalItems` is the current page size, a known deviation: do not build UI on it as a real total).
- Errors: throw subclasses of `BaseError` (`statusCode`, `errorCode`, `serialize()`). Bad input → `ValidationError` (400, with `details` from `validateRequest`), missing → `NotFoundError` (404), duplicates/in-use → `ConflictError` (409), no session → `UnauthorizedError` (401), over a rate limit → `TooManyRequestsError` (429, `TOO_MANY_REQUESTS`, raised only by `proxy.ts`). `sendError` turns anything that is not a `BaseError` into a generic `InternalServerError` (the raw message and stack only go to the log, because Drizzle messages contain the SQL and its parameters): keep it that way, never put `error.message` of an unexpected error into a response, and throw a `BaseError` subclass whenever the client should see the reason. A bad id or malformed JSON is a 4xx, not a 500 (fixed 2026-10-02, second round: `parseJsonBody()` in `utils/validateRequest.ts`, and an `isUUID` guard on every repository's `getById`/`getByIds`/`delete`) — a new controller that parses a body must use `parseJsonBody`, not a raw `request.json()`.
- Logging: `logger` from `@/modules/logger` (winston, JSON to stdout). No `console.*`.
- Config: read env through `src/modules/core/env.ts`; a new required variable is added to `requiredEnvVars` there. `JWT_SECRET` (since 2026-09-19) and `S3_PUBLIC_URL` (since 2026-09-23) are on that list; `JWT_SECRET` is still read straight from `process.env` by `proxy.ts` and `utils/jwt.ts`. A new variable also goes into `config/local.env` and `config/test.env` (the test file still lacks `JWT_SECRET`: `CHANGE-PLAN.md` CP-4).

### Auth and access

- Auth is enforced in `src/proxy.ts`, **mostly by HTTP method**: `POST/PUT/PATCH/DELETE` need a valid `accessToken` cookie (exception: public `POST /api/v1/posts/:id/comments`), every method on `/api/v1/users/**`, `/api/v1/admin/**` and `/api/v1/media/**` needs one too (the `isAdminOnlyResource` pattern; `media` joined it 2026-09-28, B12, because its only consumer is the admin media picker), `/api/v1/auth/*` needs no token (but is rate limited), and **every other `GET` is public**. A new endpoint therefore needs an explicit decision: if its `GET` must not be public, add its path to that pattern; every write route also wraps its handler in `withAdminAuth()` (`utils/withAdminAuth.ts`, fixed 2026-10-06, CP-5) — a second, independent token check at the route layer, so a new write route.ts must apply it the same way the existing ones do (`export const POST = withAdminAuth((request) => controller.method(request))`), not just rely on `proxy.ts`. A new public or expensive route (an anonymous write, an upload, anything login-like) also gets a rule in `resolveRateLimitRule` in `proxy.ts`, with its limit in `utils/rateLimit.ts`.
- Public reads must be safe by construction: entities with a draft/status state show anonymous callers only the published state on **every** path that returns them (list, by id/slug, nested routes, server-rendered metadata, sitemap), and repositories return an explicit field allowlist instead of raw rows (see `UserRepository.populate()`).
- Single-admin mode: no public registration; `ADMIN_EMAILS` (comma list, case-insensitive) is checked at the Google exchange only.
- Token-issuing logic must not be copied again: use `issueSession(userId, email, tokenFamily?)` (`utils/authSession.ts`, fixed 2026-10-02 second round) rather than a fourth route handler minting/hashing/setting cookies itself.

### Do not copy existing violations

`catch (error: any)`, `body: any` in services, business logic in route handlers, `console.*` (still true for ~34 call sites in client components; the 6 server-side ones were fixed 2026-10-02), `as any` casts on repositories. Direct DB access from services (`CategoryService.deleteCategory`, `MediaService.deleteMedia`) was fixed 2026-10-02 (second round) — both now call repository count methods instead.

## Output

- Writing mode: the code, plus a short note of the decisions made (access level of new GET/POST, new env vars, new error cases).
- Review mode: a list `file:line | layer | rule | fix`, split into *new* and *known debt* (`DEVIATIONS.md`). No files are modified by this skill itself.

## Example usage

```
/gifts-workshop-backend-standards
/gifts-workshop-backend-standards --layer service
/gifts-workshop-backend-standards --layer repository   (then ask: "check src/repositories/drizzle/tagRepository.ts")
```

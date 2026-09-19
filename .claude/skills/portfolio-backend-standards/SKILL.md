---
name: portfolio-backend-standards
description: The backend rules and patterns of the Portfolio app as they exist in code (layer templates, response and error contracts, pagination, slug-or-UUID ids, auth, storage, logging). Use when writing or reviewing anything under src/app/api, controllers, services, repositories, utils or modules, or when asked how the backend should be done.
argument-hint: "[--layer controller|service|repository|storage]"
allowed-tools: Read Grep Glob
---

# Portfolio Backend Standards

The rules to follow when writing or checking backend code. Source: `.agents/rules/backend.md` and `.agents/project-plan/backend.md` for intent, but those still describe Express, so the **code** is the authority: the concrete patterns below are read from `src/`. Stack decisions (Next.js route handlers, Drizzle + PostgreSQL, `/api/v1` prefix, `PUT` for updates) are settled and are not up for debate here.

## Trigger words

backend standards, how do we write a controller/service/repository, API conventions, response format, error handling, pagination, backend rules, стандарты бэкенда, как писать контроллер.

## Parameters

Arguments received: `$ARGUMENTS`

- `--layer controller|service|repository|storage`: show and check only that layer (default: all).

## Process

Use this as a rulebook: apply it while writing, or read the target code and list deviations. Always open one existing neighbor (the smallest complete example is Color: `colorController.ts`, `colorService.ts`, `colorRepository.ts`, `api/v1/colors/`; the slug variant is Tag) and copy its shape, not its violations.

### Layers

- **Route** (`src/app/api/v1/<resource>/route.ts`, `[id]/route.ts`): `export async function GET|POST|PUT|DELETE`, `params` is `Promise<{ id: string }>` and is awaited, one controller call, nothing else. Kebab-case, plural resource names; `PUT` updates.
- **Controller** (`src/controllers/<x>Controller.ts`): `constructor(private xService: IXService)`, one method per route, one `try { … } catch (error: unknown) { return sendError(error); }`. Body → `validateRequest(schema, raw)` (schemas in `src/common/validation/schemas.ts`, localized fields use `localizedStringSchema`), pagination → `getPaginationParams(request)`, ids → `resolveId(id, slug => service.getBySlug(slug))`, owner → `getUserId()` then merge `userId` into the payload, missing entity → `throw new NotFoundError(...)`, success → `sendSuccess(data, meta?)`.
- **Service** (`src/services/<x>Service.ts`): `implements IXService` (interface in `services/interfaces.ts`), constructor-injected repository *interfaces*, all business rules (uniqueness, cycle guard, delete guards → `ConflictError` 409), ids via `randomUUID()`, slugs via `utils/slug.ts`. Lists: fetch `limit + 1` rows and return `paginate(rows, { page, limit })` (defaults page 1, limit 20).
- **Repository** (`src/repositories/drizzle/<x>Repository.ts`): `extends DrizzleBaseRepository<T, TPopulated>` and `implements IXRepository`; implement `populate()`; add `getBySlug` when the entity has a slug; list queries load only what the list needs (`PostRepository` has a private `getListRelations()` for this; follow the same idea for any entity with relations); export a singleton `xRepository`.
- **Storage** (`src/modules/storage`): `StorageService.uploadImage` (JPEG/PNG only, size cap from `NEXT_PUBLIC_MAX_FILE_SIZE_MB`, `sharp` resize: original ≤1000 px, thumbnail ≤320 px). Intent: an Adapter/Strategy interface so MinIO can be swapped; new storage code should introduce that interface rather than call the MinIO client from services.
- **Composition root** (`src/modules/core/container.ts`): register every repository, service and controller here; nothing else instantiates them.

### Contracts

- Success: `{ data, meta? }` via `sendSuccess`. Failure: `{ data: {}, error: { code, message, details? } }` via `sendError`. Never hand-build `NextResponse.json` in controllers or routes.
- `meta` from `paginate()`: `{ page, nextPage, prevPage, totalItems }` (`totalItems` is the current page size, a known deviation: do not build UI on it as a real total).
- Errors: throw subclasses of `BaseError` (`statusCode`, `errorCode`, `serialize()`). Bad input → `ValidationError` (400, with `details` from `validateRequest`), missing → `NotFoundError` (404), duplicates/in-use → `ConflictError` (409), no session → `UnauthorizedError` (401). Never return raw `error.message` for unexpected errors and never leak stack traces.
- Logging: `logger` from `@/modules/logger` (winston, JSON to stdout). No `console.*`.
- Config: read env through `src/modules/core/env.ts`; a new required variable is added to `requiredEnvVars` there. `JWT_SECRET` is read directly today and is missing from that list: do not repeat that.

### Auth and access

- Auth is enforced in `src/proxy.ts`, **by HTTP method**: `POST/PUT/PATCH/DELETE` need a valid `accessToken` cookie (exception: public `POST /api/v1/posts/:id/comments`), `/api/v1/auth/*` is open, and **all `GET` are public**. A new endpoint therefore needs an explicit decision: if its `GET` must not be public, the proxy has to change or the controller must verify the token itself.
- Single-admin mode: no public registration; `ADMIN_EMAILS` (comma list, case-insensitive) is checked at the Google exchange only.
- Token logic must not be copied again: new auth work belongs in an `AuthService`, not in a fourth route handler.

### Do not copy existing violations

`catch (error: any)`, `body: any` in services, direct DB access from services (`CategoryService.deleteCategory`, `MediaService.deleteMedia`), business logic in route handlers, `console.*`, `as any` casts on repositories.

## Output

- Writing mode: the code, plus a short note of the decisions made (access level of new GET/POST, new env vars, new error cases).
- Review mode: a list `file:line | layer | rule | fix`, split into *new* and *known debt* (`DEVIATIONS.md`). No files are modified by this skill itself.

## Example usage

```
/portfolio-backend-standards
/portfolio-backend-standards --layer service
/portfolio-backend-standards --layer repository   (then ask: "check src/repositories/drizzle/tagRepository.ts")
```

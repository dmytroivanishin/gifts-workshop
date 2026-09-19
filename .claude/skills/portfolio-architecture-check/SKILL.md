---
name: portfolio-architecture-check
description: Checks that code respects the Portfolio layering (route → controller → service → repository), the composition root, the Zod-at-the-edge rule and the TypeScript standards. Use when adding or changing backend or shared code, or when asked to check architecture, layers, boundaries, dependencies between modules.
argument-hint: "[--target <path>]"
allowed-tools: Read Grep Glob
---

# Portfolio Architecture Check

Verifies module boundaries and the global coding standards. Sources: `.agents/rules/architect.md` (still valid) and the layer rules in `CLAUDE.md` §2. Read-only.

## Trigger words

architecture check, layers, layering, boundaries, does this follow our architecture, where should this logic live, проверь архитектуру, слои, границы модулей.

## Parameters

Arguments received: `$ARGUMENTS`

- `--target <path>`: file or folder to check (default: all of `src/`, reported by layer).

## Process

Run each check with `Grep` over the target, then open the hits and confirm.

1. **Route handlers** (`src/app/api/v1/**/route.ts`) are thin: they `await params` (Next 16: `params` is a `Promise`), call exactly one method of a controller imported from `@/modules/core/container`, and contain no query rewriting, shaping or business logic.
   - Known debt (do not report as new): `auth/**` (business logic, token block copied 3 times), `collections/[id]/posts/route.ts`, `posts/[id]/comments/route.ts`.
2. **Controllers** (`src/controllers/*`): depend on the service *interface* (`@/services/interfaces`), validate every body/param with `validateRequest(schema, …)` using schemas from `common/validation/schemas.ts`, respond only through `sendSuccess` / `sendError`, resolve slug-or-UUID with `resolveId` / `resolveMultipleIds`, read the user via `getUserId()`. They must not import `drizzle-orm`, `@/repositories/drizzle/*` or storage code.
3. **Services** (`src/services/*`): `implements` an interface from `services/interfaces.ts`, receive repositories through the constructor typed with `@/repositories/interfaces`, hold all business rules (cycle guards, in-use delete guards, slug generation, pagination via `paginate()` with `limit + 1`), throw `BaseError` subclasses. They must not import `NextResponse` / `Request`, `drizzle-orm`, `drizzleDatabase` or `@/repositories/drizzle/*`.
   - Known debt: `CategoryService.deleteCategory`, `MediaService.deleteMedia` (direct DB access); `MediaService` imports the `StorageService` singleton.
4. **Repositories** (`src/repositories/drizzle/*`): the only place that imports `drizzle-orm` and `schema.ts`; extend `DrizzleBaseRepository`, `implements` an interface from `repositories/interfaces.ts`, implement `populate()`, keep list queries light (`PostRepository` does it with a private `getListRelations()` that loads partial relations; list endpoints must not load full relation trees).
5. **Composition root** (`src/modules/core/container.ts`): every new repository, service and controller is instantiated there, in that order, and exported. Routes never `new` a controller.
6. **Utilities and types:** `src/utils/*` must not grow business logic (`utils/auth.ts` already depends on `userRepository`; do not add more). Domain types live in `src/types`; no Drizzle table types leak to the frontend (`grep` client components, marked `"use client"`, for imports of `@/repositories`, `@/services`, `@/controllers`, `@/modules/core/container`, `drizzle-orm`).
7. **Frontend layering:** server-only modules (`env.ts`, container, storage) are never imported by `"use client"` files; server state goes through RTK Query in `src/store/api.ts`; components live in `components/{ui,shared,features}` (details: `portfolio-frontend-standards`).
8. **Strict interfaces:** every module boundary has an interface or DTO; a new public method is added to the interface first.
9. **TypeScript excellence** (`architect.md`): no `any` (use `unknown`), explicit return types, `interface` vs `type`, `as const` over `enum`, Zod before casting external data, `Pick`/`Omit`/`Partial`/`Readonly`.
10. **Functional style:** `.map/.filter/.reduce`, immutability, one function = one action, comments explain "why".
11. **Error handling:** `BaseError` subclasses from `src/common/errors/*` (`ConflictError`, `ForbiddenError`, `InternalServerError`, `NotFoundError`, `UnauthorizedError`, `ValidationError`); one try/catch at the controller entry.

Useful greps (adapt the path):
`from "drizzle-orm` and `@/repositories/drizzle` inside `src/services` and `src/controllers`; `: any` / `as any` / `<any>` in the target; `console\.` in the target; `new .*Controller(` outside `container.ts`.

## Output

A table `layer | file:line | rule | severity`, then a summary per layer (OK / violations), separated into **new** and **known debt** (`DEVIATIONS.md` → Backend → Architecture). End with the smallest fix for each new violation. No files are modified.

## Example usage

```
/portfolio-architecture-check
/portfolio-architecture-check --target src/services/postService.ts
/portfolio-architecture-check --target src/app/api/v1/tags
```

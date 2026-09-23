---
name: portfolio-new-entity
description: Scaffolds a new CRUD entity end to end in the Portfolio layering (schema, types, Zod, repository, service, controller, container, routes, RTK Query, i18n keys, migration) and enforces the access checks the existing entities missed. Use when the user asks to add a new entity, resource, table or CRUD endpoint.
argument-hint: "<name> [--localized-fields a,b] [--public-read]"
disable-model-invocation: true
---

# Portfolio New Entity

Nine entities already share one shape, so a new one is a fixed sequence of edits across roughly ten files. This skill performs them in order, copying the **shape** of the closest existing entity and avoiding its known violations. It edits code, so it only runs when the user invokes it, and the plan (step 1) is confirmed before any file is written.

## Trigger words

new entity, add a resource, add CRUD for, new table, new endpoint set, добавь сущность, новый ресурс, новая таблица.

## Parameters

Arguments received: `$ARGUMENTS`

- `<name>` (required): singular PascalCase or camelCase name, for example `Review`. Derive: table `reviews`, files `reviewRepository.ts` / `reviewService.ts` / `reviewController.ts`, route `/api/v1/reviews`.
- `--localized-fields a,b`: fields stored as JSONB `Record<locale,string>` (validated by `localizedStringSchema`); other fields are plain columns. Ask for the remaining fields, their types and required-ness if not given.
- `--public-read`: the entity's `GET` endpoints may be anonymous (the site reads them). Without it, the entity is admin-only and the read endpoints need explicit protection (see step 8).

## Process

1. **Plan first.** Print: entity fields, relations (FKs and their `onDelete`), slug or not, localized fields, access level, RTK endpoints, `system_texts` keys. Reference entities: `Color` (smallest, no slug), `Tag` / `Collection` (slug + localized fields, `resolveId`), `Category` (relations and ordering). Wait for the user's confirmation.
2. **Schema** (`src/repositories/drizzle/schema.ts`): `pgTable` with `id: uuid("id").primaryKey().defaultRandom()`, `slug: varchar(...).notNull().unique()` when slugged, localized fields as `jsonb(...).$type<LocalizedText>().notNull()`, owner `userId: uuid("user_id").references(() => users.id, { onDelete: "set null" })`, one `index(...)` per FK in the table callback, `relations(...)` entries on both sides (add `many(...)` to `usersRelations`). Choose `onDelete` deliberately (`restrict` for referenced lookup data, `cascade` for join rows).
3. **Types** (`src/types/index.ts`): the domain type, plus a `Populated…` type when relations are exposed.
4. **Validation** (`src/common/validation/schemas.ts`): `<x>Schema` with Zod (reuse `localizedStringSchema`); no `any`.
5. **Repository:** add `I<X>Repository` to `src/repositories/interfaces.ts`; create `src/repositories/drizzle/<x>Repository.ts` (`extends DrizzleBaseRepository`, implement `populate()`, `getBySlug` when slugged, singleton export).
6. **Service:** add `I<X>Service` to `src/services/interfaces.ts`; create `src/services/<x>Service.ts` (constructor-injected repository interface, `randomUUID()` ids, slug via `utils/slug.ts`, lists with `limit + 1` + `paginate()`, delete guards throwing `ConflictError`). Never import `drizzleDatabase` in a service.
7. **Controller:** `src/controllers/<x>Controller.ts` following `TagController` / `ColorController` (`validateRequest`, `resolveId`, `getUserId`, `sendSuccess` / `sendError`); type the catch as `unknown` and avoid `as any`.
8. **Container** (`src/modules/core/container.ts`): register repository export, service and controller.
9. **Routes:** `src/app/api/v1/<x>/route.ts` (`GET` list, `POST`) and `[id]/route.ts` (`GET`, `PUT`, `DELETE`), thin, with `params: Promise<{ id: string }>`.
10. **Access decision** (the check the current entities missed). `src/proxy.ts` requires a token for `POST/PUT/PATCH/DELETE` on every path and, since 2026-09-19, for every method on `/api/v1/users/**` and `/api/v1/admin/**` (the `isAdminOnlyResource` pattern); every other `GET` is anonymous. With `--public-read`, confirm that nothing sensitive is returned: `populate()` returns an explicit field allowlist (as `UserRepository` does, not a raw row), and if the entity has a draft/status state, anonymous readers get only the published state through a helper modelled on `utils/postVisibility.ts` (`isAdminRequest()` from `utils/auth.ts`), applied on **every** path that returns it: list, by-id/slug (404 for unpublished, so its existence is not revealed), nested routes, server-rendered metadata and `sitemap.ts`. Without `--public-read`, the `GET` routes would be **anonymous** unless the proxy or the controller enforces a token: propose adding the resource path to `isAdminOnlyResource` (or a token check in the controller) and get approval before making it; never leave an admin-only entity readable. If the entity gets an anonymous write or an expensive endpoint, also add a rule to `resolveRateLimitRule` in `src/proxy.ts` (limits live in `src/utils/rateLimit.ts`). List routes take `page`/`limit` only through `getPaginationParams`, which caps `limit` at 100. Run `portfolio-api-exposure-check` on the new routes afterwards.
11. **Frontend data layer** (`src/store/api.ts`): add the tag to `tagTypes`, query/mutation endpoints with `providesTags` / `invalidatesTags`, exported hooks. Admin pages, if requested, follow `portfolio-frontend-standards`.
12. **i18n:** add `t()` keys for every new UI string and register them via `portfolio-i18n-sync` (area `admin` for admin screens).
13. **Migration:** hand over to `portfolio-db-migration --generate` and review the SQL. Do not run `drizzle-kit push` against anything but the local or test database, and only with the user's approval.
14. **Docs:** add the table to the `CLAUDE.md` §5 table and the routes to `.agents/project-plan/backend.md` only if the user asks; record a deviation in `DEVIATIONS.md` if the entity intentionally breaks a pattern.
15. **Verify:** `npx tsc --noEmit`, `npx eslint <new files>` (not the repo-wide `npm run lint`, which is red), and a manual API call matrix: create, read, update, delete, unauthenticated write → 401, an unpublished/admin-only record as anonymous → absent from lists and 404 by id, unknown id → 404, invalid body → 400, duplicate slug → 409.

## Output

The list of files created/changed (path + one line each), the access decision taken, the migration status, the verification results, and anything left for the user (translations, running the migration, admin UI).

## Example usage

```
/portfolio-new-entity Review --localized-fields title,text --public-read
/portfolio-new-entity Brand
```

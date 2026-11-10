---
name: gifts-workshop-db-performance
description: Reviews Drizzle/PostgreSQL performance and schema quality for the Gifts Workshop app: FK index coverage, JSONB search, list vs full relations, N+1 in populate(), pagination, connection pool, missing self-referencing FKs. Use when queries feel slow, before adding a query or index, or when asked for a database performance review.
argument-hint: "[--table <name>] [--query <repository method>]"
allowed-tools: Read Grep Glob
---

# Gifts Workshop DB Performance

Read-only review of `src/repositories/drizzle/schema.ts`, the repositories and the SQL in `src/migrations/sql`. It reasons from the code; it does not connect to the database. When a measurement is needed, it hands the user an `EXPLAIN` statement to run against their local Postgres (docker-compose service `postgres`, browsable through pgweb on :8081).

## Trigger words

slow query, db performance, index, N+1, EXPLAIN, search performance, GIN, trigram, pagination performance, connection pool, производительность БД, медленный запрос, индекс.

## Parameters

Arguments received: `$ARGUMENTS`

- `--table <name>`: limit the review to one table and the repository methods that touch it.
- `--query <repository method>`: analyze one method (for example `PostRepository.getByQuery`), including the SQL Drizzle will emit.

## Process

1. **Index coverage.** List every FK column in `schema.ts` (`.references(...)`) and every column used in `where` / `orderBy` / `join` by the repositories (for example `posts.status`, `posts.category_id`, `posts.collection_id`, `posts.created_at`, `comments.post_id`, `comments.status`, `categories.order`). Compare with the `index(...)` declarations and with `CREATE INDEX` lines in `0000_tired_human_robot.sql` (17 btree indexes at last count; the schema and the migration must agree). Report FK or filter/sort columns without an index, and indexes nothing uses. Composite index candidates: `(status, created_at)` on posts for the public list, `(post_id, status)` on comments.
2. **Search.** `PostRepository` builds `title::text ILIKE '%…%'` OR'd with the same pattern on `description` (since 2026-10-05, previously title only) on two JSONB columns: a sequential scan on both (`%`/`_`/`\` in the term are escaped before the pattern is built, since 2026-10-01 — a correctness fix, not a performance one). Options to evaluate: a generated/expression column per locale with `pg_trgm` GIN, or `to_tsvector` per locale; state the trade-off for a catalog of a few hundred rows (the scan is acceptable until the table grows).
3. **Relations loading.** Lists must load partial relations (`PostRepository.getListRelations()`), detail views full ones. Check that other list methods (`CategoryRepository.getAll` uses `getWithRelations()`) do not load more than the list UI needs.
4. **N+1.** `DrizzleBaseRepository.getAll/getByIds/saveMany` call `populate()` per row (`Promise.all(records.map(...))`), and the `populate()` of `PostRepository`, `CategoryRepository` and `CommentRepository` calls `getById()`, i.e. one extra query (with relations) per row. Confirm which public paths still reach the base implementations (posts and categories override `getAll`, but `getByIds` and `saveMany` do not) and report where a batched query (`inArray`) would replace the loop.
5. **Pagination.** The services fetch `limit + 1` rows with `OFFSET`; there is no total count (`meta.totalItems` = page size); `limit` is capped at 100 in `getPaginationParams` (since 2026-09-23; check that every list goes through it) and `GET /posts` defaults to 20. Deep offsets still degrade; note keyset pagination as the option if a catalog grows.
6. **Connections.** `DrizzleDatabase` caches its instance on `globalThis` (since 2026-10-05, previously a module static field) so `postgres(uri, { prepare: false })`'s driver-default pool (max 10) isn't recreated when `next dev`'s Fast Refresh reloads the module. For production check the pool size against Postgres `max_connections` and the number of app instances.
7. **Schema quality that affects queries.** Self-referencing links without a real FK constraint: `categories.parent_id`, `comments.reply_id` (cycle guard, parentId-existence check since 2026-10-05, and reply cleanup/existence check all live in application code, not the database; the FK constraint itself is deferred, blocked on an explicit go-ahead for the migration, `CHANGE-PLAN.md` CP-22). `ON DELETE` policy: ownership `user_id` → `SET NULL`, join tables → `CASCADE`, `posts.poster_id` and `categories.color_id` → `RESTRICT`. Unbounded tables: `token_sessions` grows on every login/refresh; `TokenRepository.deleteExpired()` (since 2026-10-01) purges rows past `expiresAt` opportunistically on each login/refresh, but a still-unexpired `isUsed` row is kept (reuse detection needs it), so the table isn't fully bounded, just no longer unbounded by dead rows.
8. **Write paths.** `save()` in the base repository does a `select` then `insert` or `update` (two round trips; an upsert would be one). Bulk operations (`reorderCategories`, `updateColorInCategories`) should run in a transaction and in one statement where possible.
9. **Request-level cost outside the repositories** that shows up as DB load: `app/layout.tsx` loads up to 2000 `system_texts` rows on every request, but the repository call is cached (`unstable_cache`, tag `system-texts`, invalidated via `revalidateTag` on admin edit — fixed 2026-10-05, see `SystemTextService`), so this is no longer a per-request DB hit. Report any other uncached request-level cost here with a pointer to `PRODUCTION-READINESS.md` (Performance).
10. **Measurement plan.** For the top 3 findings, print an `EXPLAIN (ANALYZE, BUFFERS)` statement the user can run (in pgweb or `psql`) and what to look for (`Seq Scan`, rows removed by filter, sort spill). Do not claim a speedup without a measurement.

## Output

1. **Findings table:** `area | table/method | evidence (file:line or SQL) | impact (now / at growth) | fix | effort`.
2. **Index proposals** as `CREATE INDEX` statements or Drizzle `index()` snippets (proposals only; applying them goes through `gifts-workshop-db-migration`).
3. **Measurements requested from the user** (EXPLAIN statements).

No files are modified.

## Example usage

```
/gifts-workshop-db-performance
/gifts-workshop-db-performance --table posts
/gifts-workshop-db-performance --query PostRepository.getByQuery
```

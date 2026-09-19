---
name: portfolio-db-performance
description: Reviews Drizzle/PostgreSQL performance and schema quality for the Portfolio app: FK index coverage, JSONB search, list vs full relations, N+1 in populate(), pagination, connection pool, missing self-referencing FKs. Use when queries feel slow, before adding a query or index, or when asked for a database performance review.
argument-hint: "[--table <name>] [--query <repository method>]"
allowed-tools: Read Grep Glob
---

# Portfolio DB Performance

Read-only review of `src/repositories/drizzle/schema.ts`, the repositories and the SQL in `src/migrations/sql`. It reasons from the code; it does not connect to the database. When a measurement is needed, it hands the user an `EXPLAIN` statement to run against their local Postgres (docker-compose service `postgres`, browsable through pgweb on :8081).

## Trigger words

slow query, db performance, index, N+1, EXPLAIN, search performance, GIN, trigram, pagination performance, connection pool, производительность БД, медленный запрос, индекс.

## Parameters

Arguments received: `$ARGUMENTS`

- `--table <name>`: limit the review to one table and the repository methods that touch it.
- `--query <repository method>`: analyze one method (for example `PostRepository.getByQuery`), including the SQL Drizzle will emit.

## Process

1. **Index coverage.** List every FK column in `schema.ts` (`.references(...)`) and every column used in `where` / `orderBy` / `join` by the repositories (for example `posts.status`, `posts.category_id`, `posts.collection_id`, `posts.created_at`, `comments.post_id`, `comments.status`, `categories.order`). Compare with the `index(...)` declarations and with `CREATE INDEX` lines in `0000_tired_human_robot.sql` (17 btree indexes at last count; the schema and the migration must agree). Report FK or filter/sort columns without an index, and indexes nothing uses. Composite index candidates: `(status, created_at)` on posts for the public list, `(post_id, status)` on comments.
2. **Search.** `PostRepository` builds `title::text ILIKE '%…%'` on a JSONB column: a sequential scan, title only, `%`/`_` not escaped. Options to evaluate: a generated/expression column per locale with `pg_trgm` GIN, or `to_tsvector` per locale; state the trade-off for a catalog of a few hundred rows (the scan is acceptable until the table grows; the missing description search is a functional gap, not only a performance one).
3. **Relations loading.** Lists must load partial relations (`PostRepository.getListRelations()`), detail views full ones. Check that other list methods (`CategoryRepository.getAll` uses `getWithRelations()`) do not load more than the list UI needs.
4. **N+1.** `DrizzleBaseRepository.getAll/getByIds/saveMany` call `populate()` per row (`Promise.all(records.map(...))`), and the `populate()` of `PostRepository`, `CategoryRepository` and `CommentRepository` calls `getById()`, i.e. one extra query (with relations) per row. Confirm which public paths still reach the base implementations (posts and categories override `getAll`, but `getByIds` and `saveMany` do not) and report where a batched query (`inArray`) would replace the loop.
5. **Pagination.** The services fetch `limit + 1` rows with `OFFSET`; there is no total count (`meta.totalItems` = page size); `limit` is uncapped in `getPaginationParams`. Deep offsets degrade; note keyset pagination as the option if a catalog grows, and require a cap.
6. **Connections.** `DrizzleDatabase` keeps its instance in a module static and `postgres(uri, { prepare: false })` uses the driver default pool (max 10). During dev HMR the module reloads and can create extra pools; caching the instance on `globalThis` avoids it. For production check the pool size against Postgres `max_connections` and the number of app instances.
7. **Schema quality that affects queries.** Self-referencing links without FK: `categories.parent_id`, `comments.reply_id` (cycle guard and reply cleanup live in application code). `ON DELETE` policy: ownership `user_id` → `SET NULL`, join tables → `CASCADE`, `posts.poster_id` and `categories.color_id` → `RESTRICT`. Unbounded tables: `token_sessions` rows are never purged.
8. **Write paths.** `save()` in the base repository does a `select` then `insert` or `update` (two round trips; an upsert would be one). Bulk operations (`reorderCategories`, `updateColorInCategories`) should run in a transaction and in one statement where possible.
9. **Request-level cost outside the repositories** that shows up as DB load: `app/layout.tsx` loads up to 2000 `system_texts` rows on every request (no cache). Report it here with a pointer to `PRODUCTION-READINESS.md` (Performance).
10. **Measurement plan.** For the top 3 findings, print an `EXPLAIN (ANALYZE, BUFFERS)` statement the user can run (in pgweb or `psql`) and what to look for (`Seq Scan`, rows removed by filter, sort spill). Do not claim a speedup without a measurement.

## Output

1. **Findings table:** `area | table/method | evidence (file:line or SQL) | impact (now / at growth) | fix | effort`.
2. **Index proposals** as `CREATE INDEX` statements or Drizzle `index()` snippets (proposals only; applying them goes through `portfolio-db-migration`).
3. **Measurements requested from the user** (EXPLAIN statements).

No files are modified.

## Example usage

```
/portfolio-db-performance
/portfolio-db-performance --table posts
/portfolio-db-performance --query PostRepository.getByQuery
```

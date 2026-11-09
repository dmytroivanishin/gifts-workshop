---
name: gift-workshop-db-migration
description: Reviews and prepares Drizzle schema changes and SQL migrations for the Gift Workshop app (generate, check, dev vs test target), with checks for FK policy, indexes, destructive statements and journal consistency. Use when schema.ts changes, when a migration is needed, or when asked to check migrations.
argument-hint: "[--generate] [--check] [--target dev|test]"
disable-model-invocation: true
---

# Gift Workshop DB Migration

Schema source: `src/repositories/drizzle/schema.ts`. Migrations: `src/migrations/sql` (one file so far, `0000_tired_human_robot.sql`, 13 tables; journal and snapshot in `src/migrations/sql/meta`). Config: `drizzle.config.ts` (dialect `postgresql`, reads `process.env.DB_URI` and throws when it is missing; it does **not** load dotenv). No `migrate()` call and no `db:migrate` script exist, so nothing applies migrations automatically at deploy: that decision is still open (`PRODUCTION-READINESS.md` → Database). Drizzle has no down migrations: the rollback is a backup.

## Trigger words

migration, schema change, drizzle-kit, generate migration, push schema, alter table, add column, add index, миграция, изменение схемы.

## Parameters

Arguments received: `$ARGUMENTS`

- `--check` (default when nothing is passed): review only, no file is written and no command that touches a database is run.
- `--generate`: run `drizzle-kit generate` to create the SQL file from the current `schema.ts`, then review it.
- `--target dev|test`: `dev` = `docker-compose.local.yml`'s Postgres (`config/local.env`); `test` = the test Postgres on :5433 (`config/test.env`, started by `test:infra:start`, which applies the schema with `drizzle-kit push`). Never a production database.

## Process

1. **Diff intent.** Compare `schema.ts` with the last snapshot (`meta/0000_snapshot.json`) and the SQL: list new/changed/removed tables, columns, constraints and indexes. State the intent in one sentence.
2. **Schema rules.** Every FK column has an `index(...)`; ownership `user_id` → `ON DELETE SET NULL`; join tables → `CASCADE` with a composite primary key; lookup data referenced by content (`posts.poster_id`, `categories.color_id`) → `RESTRICT`; localized text as `jsonb(...).$type<LocalizedText>()`; slugs `unique`; `NOT NULL` additions on existing tables need a default or a backfill. Known open items you may fix in a migration when asked: FKs for `categories.parent_id` and `comments.reply_id` (discussed in detail with the owner 2026-10-05, blocked on their explicit go-ahead, `CHANGE-PLAN.md` CP-22 — check for existing dangling values first, the migration fails if any exist); `users.password` nullable or removed; a trigram/GIN index for search.
3. **Generate** (only with `--generate`). The command needs `DB_URI` in the environment and writes into `src/migrations/sql`:
   ```bash
   set -a; source config/local.env; set +a
   npx drizzle-kit generate
   ```
   Show the new SQL file in full. If the generated name is meaningless it can be renamed only before it is applied anywhere, and the `meta/_journal.json` tag must be changed consistently.
4. **Review the SQL** for: `DROP TABLE` / `DROP COLUMN`, type changes that rewrite data, `NOT NULL` without default on populated tables, dropped and re-created indexes, statements Drizzle might reorder wrongly (FK before the referenced table exists). Flag each with its data-loss risk.
5. **Consistency.** Every `.sql` file has a journal entry (`_journal.json` `tag`) and a snapshot; no migration was edited after being applied; `git status` shows the three parts (sql, journal, snapshot) together.
6. **Applying.** Report the options and their trade-offs, and let the user choose: `drizzle-kit push` (schema pushed directly; what `test:infra:start` uses; fine for local and test, no history), or `drizzle-kit migrate` (applies the SQL files; the path for deployment). Run neither against a database without the user's explicit approval. Before running anything that connects, state which host and database the URI points at (never print the password). For production: take a backup first, run the migration before starting the new app version, and remember that env validation runs at import, so the migration command needs the same environment.
7. **After applying** (dev/test): ask the user to confirm the app starts (`scripts/run.sh dev`) and, if the change touched seeds, that `runSystemTextsSeed.ts` still works.
8. **Docs.** Suggest updates to the `CLAUDE.md` §5 table and to `DEVIATIONS.md` (Database & Migrations) when tables or constraints changed.

## Output

1. **Change summary** (tables/columns/indexes) and the review verdict: `safe` / `safe with backfill` / `destructive`.
2. **Findings table:** `check | file:line | result | action`.
3. With `--generate`: the created file names and the exact command to apply them for the chosen target, marked as *not run*.
4. Open decisions (push vs migrate, backup) that block deployment.

## Example usage

```
/gift-workshop-db-migration --check
/gift-workshop-db-migration --generate --target dev
/gift-workshop-db-migration --generate --target test
```

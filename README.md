# Добрые подарки / Kind Gifts

A handmade-goods portfolio (soft toys, dolls, textiles, kitchen textiles) with a public,
localized (ru/en) catalog and a single-admin CMS. Frontend and backend live in one
Next.js app — see `CLAUDE.md` for the full architecture, status and open issues; this
file only covers getting it running locally.

**Not production-ready yet.** No deployment config exists; see `CLAUDE.md` §12 and
`PRODUCTION-READINESS.md` before deploying anywhere.

## Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL + Drizzle ORM · MinIO (S3-compatible
storage) · Redux Toolkit + RTK Query · Tailwind CSS 4 + shadcn/ui · Google OAuth + JWT
sessions. Full breakdown: `CLAUDE.md` §1.

## Local setup

1. **Start the local services** (Postgres, MinIO, pgweb — a DB browser at
   `localhost:8081`):
   ```bash
   npm run local:infra:start
   ```
   (`docker-compose.local.yml` — named so it pairs clearly with `docker-compose.test.yml`; plain
   `docker-compose up -d` no longer auto-discovers it without `-f docker-compose.local.yml`.)
2. **Create `config/local.env`** (git-ignored — ask whoever owns this repo for the real
   values, or copy `config/test.env` as a mocked-out starting point). The full list of
   required variables and what each one is for is `CLAUDE.md` §9 — there is no `.env.example`
   file, that section is the reference.
3. **Push the database schema:**
   ```bash
   set -a; source config/local.env; set +a
   npx drizzle-kit push
   ```
   (`drizzle.config.ts` reads `DB_URI` straight from `process.env`, it does not load
   `config/local.env` itself — hence sourcing it into the shell first.)
4. **Seed the admin UI strings** (required on a brand-new database — without this every
   label on both the public site and the admin panel renders as its raw key, e.g.
   `search_placeholder` instead of real text):
   ```bash
   npx tsx src/migrations/seeds/runSystemTextsSeed.ts
   ```
   Only `system_texts` has a seed loader today; categories/tags/colors/collections are
   created by hand through the admin UI once you've logged in (see `CHANGE-PLAN.md` CP-24
   for the plan to automate this).
5. **Run the app:**
   ```bash
   bash scripts/run.sh dev
   ```
   Use `bash`, not `npm run dev` directly — the script is not executable and is what
   loads `config/local.env` into the process; plain `npm run dev` starts with no env vars
   at all. The app is then at `http://localhost:3000`, admin login at `/admin/login`.

## Scripts

```bash
bash scripts/run.sh dev     # next dev with config/local.env loaded
bash scripts/run.sh build   # next build (same env loading)
bash scripts/run.sh start   # next start, after a build
npm run lint                # eslint — currently red, see CLAUDE.md §11

# Tests: an API test suite exists (tests/api/**, CHANGE-PLAN.md CP-31 phase 1); unit (vitest)
# and e2e specs don't yet
scripts/run-test.sh test:infra:start   # test Postgres :5433 + test MinIO :9002 + drizzle-kit push
scripts/run-test.sh test:unit          # vitest run
scripts/run-test.sh test:api           # playwright --project=api (test:e2e for --project=e2e)
scripts/run-test.sh test:infra:stop
```

## Troubleshooting

**The app throws a database error right after starting Docker** (e.g. a failed query on
`categories` or any other table): a brand-new or just-recreated Postgres container has an
empty database — the schema needs to be pushed again, same as step 3 above:
```bash
set -a; source config/local.env; set +a
npx drizzle-kit push
```
Then stop any old `next dev` still running and start a clean one with
`bash scripts/run.sh dev`. (Two dev servers fighting over port 3000 produces a different,
unrelated error — check `lsof -i :3000` / `pgrep -af "next dev"` first if this is the
second time you're starting it.)

**The UI shows raw text keys instead of real copy** (e.g. `search_placeholder` or
`in_stock` literally on the page, on either the public site or the admin panel): this is
almost always `unstable_cache`'s on-disk dev cache (`.next/dev/cache/fetch-cache`) serving
a stale snapshot from before a restart or a `DB_URI` change, even when `system_texts` is
correctly seeded in the database. Fix:
```bash
rm -rf .next/dev/cache/fetch-cache
```
then restart `bash scripts/run.sh dev`. If this doesn't help, confirm `system_texts`
actually has rows (`npx tsx src/migrations/seeds/runSystemTextsSeed.ts` is safe to re-run
on a database that already has them).

## Where the real documentation lives

- **[`docs/BUSINESS-LOGIC.md`](docs/BUSINESS-LOGIC.md)** — what the app actually does:
  every feature on the public site and in the admin CMS, section by section.
- **`CLAUDE.md`** — the technical reference: architecture, folder structure, API, auth,
  storage, env vars, current status, known issues. Read this first for anything beyond
  "how do I run it."

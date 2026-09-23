---
name: portfolio-deployment-validator
description: Validates deployment readiness of the Portfolio app: docker-compose files, env variable whitelist vs config files, build-time vs runtime NEXT_PUBLIC_* values, Dockerfile/Coolify prerequisites, migrations, health endpoint, storage URL. Use before a deploy, when writing the Dockerfile, or when asked whether the app is ready for the VPS/Coolify.
argument-hint: "[--env local|test|prod]"
allowed-tools: Read Grep Glob Bash(git ls-files *) Bash(sed * config/*.env)
---

# Portfolio Deployment Validator

Read-only check of everything that decides whether the app will start and behave in a given environment. Sources: `docker-compose.yml`, `docker-compose.test.yml`, `config/*.env` (names only), `src/modules/core/env.ts`, `scripts/run.sh`, `next.config.ts`, `CLAUDE.md` §9/§12 and `PRODUCTION-READINESS.md` (Deployment). It never runs `docker`, `npm`, `next build` or any network command; if a build/run result is needed, give the user the exact command and ask for the output.

## Trigger words

deploy, deployment check, is it ready for prod, Coolify, VPS, Dockerfile, docker-compose review, env variables check, готовность к деплою, проверь деплой, проверь compose.

## Parameters

Arguments received: `$ARGUMENTS`

- `--env local|test|prod` (default: `prod`). `local` = `docker-compose.yml` + `config/local.env`; `test` = `docker-compose.test.yml` + `config/test.env`; `prod` = the planned VPS/Coolify deployment (Dockerfile route).

Never print secret values. To compare variables, list names only, for example `sed 's/=.*//' config/local.env`. Do not `cat` env files.

## Process

1. **Env whitelist vs files.** Extract `requiredEnvVars` from `src/modules/core/env.ts` (the app throws at import when any is missing, including during `next build`). Compare with the names in the chosen `config/*.env`, and with the names documented in `CLAUDE.md` §9. Report missing, extra and unused ones. Known items: `GOOGLE_CALLBACK_URL` is required but unused; `JWT_SECRET` has been in the whitelist since 2026-09-19 (it is still read straight from `process.env` by `proxy.ts` and `utils/jwt.ts`), and it is **missing from `config/test.env`**, so a test run that imports `env.ts` fails at start (`CHANGE-PLAN.md` CP-4); `SITE_TITLE` / `SITE_TEMPLATE` / `SITE_DESCRIPTION` / `SITE_NAME` (no locale suffix) are read by `app/layout.tsx` but not whitelisted.
2. **Build-time vs runtime.** `NEXT_PUBLIC_*` are inlined at build: list them and require that they are passed as build args, not only as runtime env. `NEXT_PUBLIC_DEV_MODE` must be `false` in the production build (it enables `POST /auth/dev-login`; the route also answers 403 when `NODE_ENV=production`, so the flag is now a second guard, not the only one), and `NEXT_PUBLIC_APP_URL` must be the final HTTPS origin. Secrets (`JWT_SECRET`, `S3_*`, `GOOGLE_CLIENT_SECRET`, `DB_URI`) are runtime-only.
3. **Compose (local/test).** Review against the current files: `postgres:16-alpine` (db `portfolio`, :5432, bind mount `./.docker/db-data`), `minio/minio` pinned release (:9000 API, :9001 console, `./.docker/minio-data`), `pgweb:latest` (unpinned, :8081), subnet `10.10.10.0/24`, `restart: always`, no healthchecks, hardcoded dev credentials. Test compose: `postgres:15-alpine` on :5433 with a named volume and subnet `172.30.0.0/16` (version differs from dev: flag it). `.docker/` must stay git-ignored.
4. **Production shape (`--env prod`).** Checklist, each item `ok` / `missing` / `undecided`:
   - `Dockerfile` (multi-stage, `output: "standalone"` in `next.config.ts`, a base image that supports `sharp`, `NEXT_PUBLIC_*` as build args) and `.dockerignore`;
   - health endpoint (for example `GET /api/health` checking the DB) for Coolify;
   - migration step before start (no `migrate()` and no `db:migrate` script exist; decide between `drizzle-kit migrate` in the deploy command or a pre-start script; Drizzle has no down migrations, so backups matter);
   - MinIO: bucket exists with public-read policy (`initializeBucket()` is exported but never called), and the **public** MinIO URL is used as `S3_ENDPOINT` from the first upload because URLs are stored absolute in `media` rows;
   - `/sitemap.xml` is prerendered at build from the DB (empty in a Docker build, stale afterwards): must become dynamic;
   - `env.ts` is evaluated at build: the build needs the whole env, and page generation touches the DB;
   - cookies: `NODE_ENV=production` so `Secure` is set; TLS terminated by Coolify (Let's Encrypt);
   - Google Cloud Console: redirect URI exactly `https://<domain>/admin/login` (user action);
   - production credentials for Postgres, MinIO and `JWT_SECRET` are new, never the compose dev values; pgweb and the MinIO console are not published;
   - backups for Postgres (scheduled `pg_dump`, tested restore) and the bucket, retention decided (user action);
   - logging to stdout (winston JSON), uptime and disk alerts;
   - security headers and rate limiting (Traefik middleware or `proxy.ts`).
5. **Cross-check the blockers.** Read `PRODUCTION-READINESS.md` B1–B11 (B1–B6 are in the "Fixed in code" table, B7–B11 are open) and `CHANGE-PLAN.md`; a deployment is `NOT READY` while any HIGH blocker is open, or CP-2 (dependency upgrade and re-verified build) or CP-4 (manual check of the B1–B6 fixes) is unresolved.
6. **Requests for the user.** For anything that needs execution (`scripts/run.sh build`, `docker compose config`, image build), print the exact command and what output to paste back.

## Output

1. **Verdict:** `READY` / `READY WITH RISKS` / `NOT READY` for the chosen `--env`, with the reason in one line.
2. **Checklist table:** `area | item | status | evidence (file:line) | action`.
3. **Env matrix:** variable name × (in whitelist, in `config/local.env`, in `config/test.env`, build-time/runtime).
4. **Blockers carried over** from `PRODUCTION-READINESS.md`, and **commands for you to run**.

No files are modified. Writing the Dockerfile itself is a separate, explicitly requested task.

## Example usage

```
/portfolio-deployment-validator
/portfolio-deployment-validator --env local
/portfolio-deployment-validator --env test
```

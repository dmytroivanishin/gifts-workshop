# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Canonical reference for this repo.** The current code in `src/` is the source of truth. `.agents/project-plan/*` is intent and may be outdated; where they disagree, the code wins (differences are catalogued in `DEVIATIONS.md`).

> **This is NOT the Next.js you know.** This project runs Next.js 16 with breaking changes: APIs, conventions and file structure may differ from your training data (for example, `middleware.ts` is now `proxy.ts`). Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code, and heed deprecation notices.

## Working agreements

- **Open steps live in `CHANGE-PLAN.md`** (imported below, so it is always in context). At the start of a session, and before new work, remind the user of the open items that wait on them (ID + what is needed), and update the plan when an item is answered or completed.
- Do not run commands that need the network or change dependencies (`npm install`, `npm audit`, `npm outdated`, …). Give the exact command to the user and ask for the output. Saved outputs live in `.claude/command-output/` (git-ignored); read them from there, and ask for a fresh run when the code or lockfile is newer than the file.
- Do not add or change code beyond what was asked; audits and docs work is documentation-only unless told otherwise.
- Every external input goes through Zod; no `any` (use `unknown`), explicit return types, `interface` for shapes / `type` for unions, `as const` over `enum`, functional style, comments explain "why" only. Existing code violates some of these (see §11); do not copy the violations into new code.

---

## 1. Project Summary

**Purpose:** a handmade-goods portfolio (soft toys, dolls, textiles, kitchen textiles; brand "Добрые подарки / Kind Gifts") with a public catalog and a single-admin CMS. Content is localized (ru/en, configurable).

**Stack**
- Next.js 16.2 (App Router, TypeScript strict), React 19.2. Frontend and backend live in one Next app (route handlers under `src/app/api/v1`).
- PostgreSQL 16 + Drizzle ORM (`drizzle-orm`, `postgres` driver, `drizzle-kit`).
- File storage: MinIO (S3-compatible, `minio` client) + `sharp` for image processing. DB browser: pgweb (dev only).
- Auth: Google OAuth (authorization code) → own JWT (`jose`) in HttpOnly cookies, restricted to `ADMIN_EMAILS`.
- State: Redux Toolkit + RTK Query (`src/store`). Forms: react-hook-form + zod 4.
- UI: Tailwind CSS 4, shadcn/ui (style `radix-nova`, Radix), lucide-react, react-icons, framer-motion, dnd-kit (drag-and-drop), sonner (toasts). No dark mode.
- Logging: winston (JSON to stdout).
- Infra: Docker Compose for local dev; production target is a VPS with Coolify, deployed from a Dockerfile (neither exists yet; nothing is deployed).

**Status**
- Core feature set is implemented: public catalog + project pages, admin CMS (projects, categories, collections, tags, colors, media, comments, localization), Google login, uploads, i18n, SEO metadata/sitemap.
- **Not production-ready**: security blockers, no deployment config, no tests. See §11–12.
- Checked 2026-09-19: `next build` passes, `tsc --noEmit` is clean, `npm run lint` fails (348 errors, 77 warnings), `npm audit` reports 20 findings (1 critical, on Next).
- Not implemented from the plans: users/profile UI, SEO settings page, dedicated archive view, multi-select category filter, tests/Prettier. See `DEVIATIONS.md`.

---

## 2. Architecture Overview

```
src/app/api/v1/**/route.ts   thin handlers: call one controller method
        ↓
src/controllers/*            parse request, validate with Zod (common/validation/schemas.ts),
                             respond via utils/apiResponse (sendSuccess / sendError)
        ↓
src/services/*               business logic; contracts in services/interfaces.ts
        ↓
src/repositories/drizzle/*   Drizzle queries; contracts in repositories/interfaces.ts;
                             all extend DrizzleBaseRepository (getAll/getById/save/delete/…)
```

- **Composition root:** `src/modules/core/container.ts` builds repositories → services → controllers (manual DI, module-level singletons). A new entity must be registered there; routes import controllers from it.
- **Errors:** throw subclasses of `BaseError` (`src/common/errors/*`, each with `statusCode`, `errorCode`, `serialize()`); controllers catch and return `sendError`. Envelope: `{ data, meta? }` on success, `{ data: {}, error: { code, message, details? } }` on failure.
- **Slug-or-UUID:** most `:id` routes accept either; `utils/idResolver.ts` (`resolveId`, `resolveMultipleIds`) resolves slugs.
- **Pagination:** `getPaginationParams` reads `?page&limit`; services fetch `limit + 1` and `services/pagination.ts` builds `meta` (`totalItems` is the current page size, not a total).
- **Config/env:** `src/modules/core/env.ts` validates required env vars at import and throws if any is missing (note: `JWT_SECRET` is not on that list).
- **Auth boundary:** `src/proxy.ts` (see §6). Locale routing is also handled there.
- **Frontend:** `src/app/[locale]/(public)` public site (client components fetching through RTK Query; server side only for metadata, sitemap, robots); `src/app/admin/*` CMS (client components, shadcn-heavy). Components: `components/ui` (shadcn primitives), `components/shared`, `components/features`.
- **i18n (custom, `src/i18n/index.tsx`):** UI strings come from the `system_texts` table (loaded in the root layout, `t(key)`); entity fields are JSONB `{locale: text}` resolved with `loc(field)` / `utils/localization.ts`. Public locale is in the URL (`/ru`, `/en`); admin locale is in the `admin_locale` cookie.

Detailed rules and history: `.agents/rules/architect.md`, `.agents/rules/frontend.md` (both still valid), `.agents/rules/backend.md` (stale, mentions Express).

---

## 3. Commands

```bash
scripts/run.sh dev            # next dev with config/local.env exported (plain `npm run dev` does NOT load it)
scripts/run.sh build          # next build (same env loading)
scripts/run.sh start
npm run lint                  # eslint (next core-web-vitals + typescript); currently RED, see §11
docker-compose up -d          # local Postgres :5432, MinIO :9000/:9001, pgweb :8081

# Drizzle (drizzle.config.ts reads process.env.DB_URI and does not load dotenv)
set -a; source config/local.env; set +a
npx drizzle-kit generate      # create SQL migration from src/repositories/drizzle/schema.ts → src/migrations/sql
npx drizzle-kit push          # or apply schema directly (dev/test)
npx tsx src/migrations/seeds/runSystemTextsSeed.ts   # seed system_texts (loads config/local.env itself)

# Tests: scripts exist, but there is NO vitest/playwright config and NO test files yet
scripts/run-test.sh test:db:start    # test Postgres :5433 + drizzle-kit push (config/test.env)
scripts/run-test.sh test:unit        # vitest run
npx vitest run path/to/file.test.ts  # single unit test
scripts/run-test.sh test:api         # playwright --project=api;  test:e2e for --project=e2e
npx playwright test path/to/spec.ts --project=api   # single spec
scripts/run-test.sh test:db:stop
```

Nothing runs migrations at app startup or deploy time; `initializeBucket()` (creates the MinIO bucket and public-read policy) is exported but never called.

---

## 4. Folder Structure (`src/`)

```
app/
  [locale]/(public)/        home (page.tsx), projects/[slug]/{layout,page}.tsx
  admin/                    login, dashboard, projects/[id], categories, collections, tags,
                            colors, media, comments, localizations/[entityType]/[id]
  api/v1/                   auth/*, posts, categories, collections, tags, colors, media, users,
                            system-texts, admin/comments; each folder has route.ts (+ [id])
  layout.tsx sitemap.ts robots.ts error.tsx not-found.tsx globals.css
common/errors, common/validation   BaseError family; Zod schemas
components/{ui,shared,features}
controllers/                one class per entity
i18n/index.tsx              I18nProvider, useTranslation
migrations/sql, migrations/seeds   Drizzle SQL + seed JSON (only system-texts has a runner)
modules/core/{container,env}.ts, modules/logger, modules/storage (StorageService, minioClient)
repositories/{interfaces.ts, drizzle/}   schema.ts, database.ts (singleton), one repo per entity
services/                   one service per entity + interfaces.ts + pagination.ts
store/                      api.ts (RTK Query, 42 endpoints, silent refresh), slices, middleware
types/                      domain types (+ auth.ts)     utils/   auth, jwt, slug, uuid, apiResponse, …
proxy.ts                    auth guard + locale routing
```

---

## 5. Database (Drizzle + PostgreSQL)

Schema: `src/repositories/drizzle/schema.ts`. One migration: `src/migrations/sql/0000_tired_human_robot.sql` (13 tables, 17 btree indexes). Localized fields are JSONB `Record<locale,string>`.

| Table | Key columns / notes |
|-------|--------------------|
| `users` | `email` (unique), `name`, `password` (NOT NULL; placeholder string for admin) |
| `token_sessions` | refresh sessions: `id`=JTI, `user_id`→users (cascade), `refresh_token_hash`, `is_used`, `expires_at`, `token_family` |
| `system_texts` | `code` (unique key), `content` JSONB, `area` = `public`/`admin`/`shared` |
| `colors` | `color` hex; `user_id` |
| `media` | `thumbnail_url`, `original_url`, `width`, `height`, `orientation`, `user_id` |
| `collections` | `slug` (unique), `title`, `description`, `main` |
| `categories` | `slug`, `title`, `description`, `order`, `parent_id` (no FK constraint), `color_id`→colors (restrict), `collection_id` |
| `tags` | `slug`, `name` |
| `categories_to_tags` | PK (`category_id`,`tag_id`), cascade |
| `posts` | `slug`, `title`, `description`, `poster_id`→media (restrict), `in_stock`, `status` (`Draft`/`Published`/`Archived`), `collection_id`, `category_id`, `created_at` (used for manual ordering) |
| `posts_to_media` | PK (`post_id`,`media_id`), `order`, `position` JSONB `{x,y,zoom}` |
| `posts_to_tags` | PK (`post_id`,`tag_id`), cascade |
| `comments` | `post_id`→posts (cascade), `name`, `text`, `status` (`Review`/`Approved`/`Rejected`), `reply_id` (no FK constraint) |

Ownership FKs (`user_id`) are `ON DELETE SET NULL`. Repositories re-expose `tagsIds` and `media` arrays to services. The seed JSONs in `migrations/seeds/initial-data` (categories, tags, colors, collections, users, system-texts) have loaders only for system texts.

---

## 6. Authentication & Authorization

- **Login:** `/admin/login` → Google authorize URL (`response_type=code`, scope `openid email profile`, redirect `origin + /admin/login`, no `state`/PKCE) → `POST /api/v1/auth/google/exchange {code, redirectUri}`. The server exchanges the code with Google, decodes the ID token, and allows only emails in `ADMIN_EMAILS` (comma list, case-insensitive). It then finds/creates the `users` row and issues cookies.
- **Tokens:** `accessToken` JWT (HS256, 15 min, payload `{userId, role:"admin"}`, cookie path `/`) and `refreshToken` (`<jti>.<random>`, hash stored in `token_sessions`, 7 days, cookie path `/api/v1/auth`). Both HttpOnly, SameSite=Strict, `Secure` in production.
- **Refresh:** `POST /api/v1/auth/refresh` rotates the token; reuse of a used token, or refreshing while the access token has >2 min left, revokes the whole `token_family`. `store/api.ts` performs a silent refresh on 401 and redirects to `/admin/login` on failure.
- **Dev bypass:** `POST /api/v1/auth/dev-login` when `NEXT_PUBLIC_DEV_MODE=true` (build-time flag; must be `false` in production).
- **Guard (`src/proxy.ts`):** `/admin/*` (except `/admin/login`) needs a valid `accessToken` cookie, otherwise redirect to login. `/api/v1/*`: `/auth/*` is open; any `POST/PUT/PATCH/DELETE` needs a valid JWT, except public `POST /api/v1/posts/:id/comments`; **all `GET` are unauthenticated at the proxy** (see §11). The proxy verifies signature/expiry only, not email or role.
- `utils/auth.ts → getUserId()` reads the cookie in controllers to stamp `userId` on created entities.
- No rate limiting, no CSRF token (SameSite=Strict only), no CORS headers (same-origin).

---

## 7. API

- Base path `/api/v1`. Full route list and target contracts: `.agents/project-plan/backend.md` and `diagram.jpg` (the code implements the same resources at `/api/v1/<resource>`, uses `PUT` for updates, and has no `/admin/` segment except `/admin/comments/*`; see `DEVIATIONS.md`).
- Public site reads: `GET /posts?search&category&tag&collection&inStock&status&page&limit` (`category` is comma-separated slugs/UUIDs), `GET /posts/:slugOrId`, `/categories`, `/collections`, `/tags`, `/colors`, `/system-texts`, `GET/POST /posts/:id/comments` (GET returns only `Approved`).
- Writes require the admin cookie (see §6). Media upload is `POST /media` as `multipart/form-data` with `files`.
- Client code calls the API through RTK Query endpoints in `src/store/api.ts`; add an endpoint there when adding a route.

---

## 8. File Storage (MinIO / S3)

- Used for post images. `MediaService.uploadMultiple` → `StorageService.uploadImage` (`src/modules/storage`): JPEG/PNG only, max `NEXT_PUBLIC_MAX_FILE_SIZE_MB`, resized with `sharp` to fit 1000×1000 (original) and 320×320 (thumbnail), format preserved.
- Objects are stored in bucket `S3_BUCKET_NAME` as `<uuid>-<timestamp>-<name>[-thumb].<ext>`; the public URL `${S3_ENDPOINT}/${bucket}/${object}` is stored in the `media` row (absolute URLs). The bucket is expected to exist with public read (`initializeBucket()` does this but is not called).
- A media row cannot be deleted while it is a post poster or gallery item (409 `MEDIA_IN_USE`).
- No presigned URLs; reads are public, writes go through the API only.
- There is no storage interface yet (planned Adapter/Strategy); `StorageService` talks to MinIO directly.

---

## 9. Docker & Infrastructure

`docker-compose.yml` (local dev only): `postgres` (16-alpine, db `portfolio`, :5432, data in `./.docker/db-data`), `minio` (pinned release, :9000 API / :9001 console, data in `./.docker/minio-data`), `pgweb` (:8081). Fixed subnet `10.10.10.0/24`, `restart: always`, no healthchecks, dev credentials hardcoded. `docker-compose.test.yml`: Postgres 15 on :5433 for tests. **No app service, no Dockerfile, no CI.**

**Environment variable names** (values live in `config/local.env`, git-ignored; `config/test.env` holds mock values; all listed are required by `env.ts` except `JWT_SECRET`):

```
DB_URI
S3_ENDPOINT  S3_ACCESS_KEY  S3_SECRET_KEY  S3_BUCKET_NAME  S3_FORCE_PATH_STYLE
GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET  GOOGLE_CALLBACK_URL (unused by the code)  ADMIN_EMAILS
JWT_SECRET
NEXT_PUBLIC_APP_URL  NEXT_PUBLIC_DEFAULT_LOCALE  NEXT_PUBLIC_SUPPORTED_LOCALES
NEXT_PUBLIC_MAX_FILE_SIZE_MB  NEXT_PUBLIC_DEV_MODE  NEXT_PUBLIC_SOCIAL_LINKS (JSON array)
SITE_{TITLE,TEMPLATE,DESCRIPTION,KEYWORDS,NAME,FOOTER,PROJECT_NOT_FOUND,PROJECT_DEFAULT}_{RU,EN}
```

`NEXT_PUBLIC_*` values are inlined at build time.

---

## 10. Current Status

Working: Google login + token rotation, public catalog with search / category / in-stock / favorites (localStorage) filters and infinite scroll, project page (masonry gallery, contact links, moderated comments), admin CRUD for all entities, drag-and-drop ordering (categories, media in a post), crop modal, media library with delete protection, localization editor (DB-driven texts), slug URLs with UUID→slug redirect, OpenGraph/hreflang metadata, sitemap.xml, robots.txt.

In progress / missing: see `DEVIATIONS.md` (`[gap]` items). No automated tests exist.

---

## 11. Known Issues & Security Concerns

Full detail with file references: `PRODUCTION-READINESS.md`. Summary:

| Problem | Status | Priority |
|---------|--------|----------|
| Public `GET /users` (incl. `password` column) and `GET /admin/comments`: the proxy protects only mutating methods | Open | HIGH |
| Draft/Archived posts readable anonymously (no default `status` filter on `GET /posts`, `/posts/:slug`, `/collections/:id/posts`) | Open | HIGH |
| HTTP 500 returns raw `error.message`; invalid UUIDs/JSON/`limit` reach it | Open | HIGH |
| `JWT_SECRET` not in the required-env list; `NEXT_PUBLIC_DEV_MODE` (dev-login) is a build-time flag | Open | HIGH |
| No rate limiting (auth, upload, public comments); `limit` uncapped | Open | HIGH |
| `next@16.2.6`: critical advisories incl. Middleware/Proxy bypass (`proxy.ts` is the only auth gate); `sharp@0.34.5` high. Fix: next ≥16.3.5, sharp 0.35.4; never `npm audit fix --force` (downgrades `minio`); move `shadcn` to devDependencies | Open | HIGH |
| OAuth: no `state`/PKCE; ID token not verified for `aud`/`email_verified` | Open | MEDIUM |
| "Premature refresh" heuristic can log the admin out | Open | MEDIUM |
| Services bypass repositories (`CategoryService.deleteCategory`, `MediaService.deleteMedia`); auth logic lives in route handlers (copied 3×) | Open | MEDIUM |
| Self-referencing FKs missing (`categories.parent_id`, `comments.reply_id`) | Open | MEDIUM |
| Search: `title::text ILIKE` (no GIN/trigram), title only | Open | MEDIUM |
| `/sitemap.xml` is prerendered at build from the DB (static, then stale; empty of posts in a Docker build) | Open | MEDIUM |
| Media pipeline differs from plan (no JPG conversion, 1000/320 px), MIME is client-declared | Open | MEDIUM |
| `meta.totalItems` = page size; `/collections/:id/posts` double-wrapped | Open | LOW |
| Lint red: 348 errors (321 `no-explicit-any`, 19 `set-state-in-effect`); 41 `console.*` bypass the logger; `import * as LucideIcons`; raw `<img>`; Google Fonts via `@import` | Open | LOW |
| Fixed since the older audits: client-side admin guard, `getUserId` payload mismatch, default JWT secret, no indexes, list over-fetch, category cycles, slug URLs | Fixed | – |

`audit_results.md`, `report.md`, `tags_review.md` (untracked, root) are earlier working notes; `AUDIT-SUMMARY.md` records which of their findings still hold.

---

## 12. Production Readiness (VPS + Coolify)

Checklist and open questions: `PRODUCTION-READINESS.md`. Headlines: close the §11 HIGH items; write the Dockerfile (chosen route) with a health endpoint and `output: "standalone"`, and make the sitemap dynamic; decide the public MinIO URL (stored in DB); add a migration step to deploy; SSL via Coolify (Let's Encrypt); automated backups for Postgres and the bucket; keep `NEXT_PUBLIC_DEV_MODE=false` in build variables; never reuse compose dev credentials.

---

## 13. Quick Links

- Rules: `.agents/rules/architect.md` (layering, TS, style), `frontend.md`, `design.md` (visual language: no dark mode, 12px cards, pill controls, Inter + Playfair Display), `backend.md` (stale stack), `workspace.md`, `system_rules.md`, `quota-rules.md`
- Workflow: `.agents/workflows/review.md` (deep code review)
- Plans and references: `.agents/project-plan/{general,backend,frontend,colors,theme_design}.md`, `design.jpg`, `diagram.jpg` (REST + DB schema), `example-ui/`
- Generated docs: `DEVIATIONS.md`, `PRODUCTION-READINESS.md`, `SKILL-CANDIDATES.md`, `AUDIT-SUMMARY.md`
- Project skills (`.claude/skills/portfolio-*/SKILL.md`, invoked as `/portfolio-<name>`): `code-review`, `architecture-check`, `security-audit`, `backend-standards`, `frontend-standards`, `deployment-validator`, `api-exposure-check`, `db-performance`, `requirements-check`, `new-entity`, `i18n-sync`, `db-migration`, `design-check`, `dependency-audit`, `docs-sync`. Details: `SKILL-CANDIDATES.md`.
- Open steps and reminders: `CHANGE-PLAN.md`

---

## 14. Open Steps (imported from `CHANGE-PLAN.md`)

@CHANGE-PLAN.md

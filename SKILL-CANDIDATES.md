# Skill Candidates

**Created 2026-09-19:** all 15 candidates below exist as project skills in `.claude/skills/gifts-workshop-<name>/SKILL.md`. Claude Code loads project skills only as `<folder>/SKILL.md` and takes the command from the folder name; the `plugin:skill` colon form exists only for plugins. So `/gifts-workshop:code-review` became **`/gifts-workshop-code-review`**, and so on for each row (the `/gifts-workshop:<name>` names in the table below are the original candidate names). The "update first" / "derive from code" notes below record what was corrected while writing each skill; the stale source files in `.agents/` were not edited.

Skills that write files (`new-entity`, `i18n-sync`, `db-migration`) are user-invoked only (`disable-model-invocation: true`); the rest are read-only audits. None of them runs network or dependency commands.

Status legend:
- **ready**: the source is accurate and self-contained; can be packaged as is.
- **update first**: the source is partly stale (see `DEVIATIONS.md` → "Documentation drift"); fix it, then package.
- **derive from code**: there is no usable source doc; write the skill from what the code does.

## Candidates

| Skill | Source | Parameters | Status |
|-------|--------|------------|--------|
| `/gifts-workshop:code-review` | `.agents/workflows/review.md` (5-step review) | `--scope <path\|diff>`, `--area backend\|frontend\|all` | update first: it points at a missing `theme_colors.md`; the Design step should reference `.agents/project-plan/colors.md` + `theme_design.md` |
| `/gifts-workshop:architecture-check` | `.agents/rules/architect.md` + the layer rules in `CLAUDE.md` §2 | `--target <path>` | ready: checks Controller → Service → Repository boundaries, no `any`, explicit return types, Zod at the edge |
| `/gifts-workshop:backend-standards` | `.agents/rules/backend.md`, `project-plan/backend.md` | `--layer controller\|service\|repository\|storage` | derive from code: `backend.md` still describes Express; the real rules are the container wiring, `sendSuccess`/`sendError` contract, `BaseError` family, `resolveId` slug/UUID pattern |
| `/gifts-workshop:frontend-standards` | `.agents/rules/frontend.md`, `rules/design.md` | `--target <path>`, `--area public\|admin` | update first: still accurate on RTK Query/shadcn/`components/{ui,shared,features}`, but says default exports and `src/services/`, and code uses named exports and `src/store/api.ts` |
| `/gifts-workshop:security-audit` | `PRODUCTION-READINESS.md` (Security), auth section of `backend.md`, `src/proxy.ts`, `src/app/api/v1/auth/**` | `--focus auth\|api-exposure\|uploads\|headers\|all` | derive from code. Note: `.agents/rules/system_rules.md` is **not** a security doc (it is AI-collaboration process), so it is not a source |
| `/gifts-workshop:api-exposure-check` | `src/proxy.ts` + all `route.ts` + controllers | `--method GET\|all` | derive from code: builds the route × method × auth table and flags public GETs that return admin-only data or unpublished content (would have caught B1–B3 in `PRODUCTION-READINESS.md`) |
| `/gifts-workshop:db-performance` | `src/repositories/drizzle/*`, `schema.ts`, migration SQL | `--table <name>`, `--query <repo method>` | derive from code: FK index coverage, JSONB `ILIKE`/GIN, list vs full relations (`getListRelations`), N+1 in `populate()`, missing self-FKs |
| `/gifts-workshop:deployment-validator` | `docker-compose.local.yml`, `docker-compose.test.yml`, `config/*.env`, `env.ts`, `PRODUCTION-READINESS.md` (Deployment) | `--env local\|test\|prod` | derive from code: env whitelist vs compose/Coolify variables, healthchecks, volumes, build-time vs runtime `NEXT_PUBLIC_*`, migration step, dev-mode flag off |
| `/gifts-workshop:requirements-check` | `.agents/project-plan/{general,backend,frontend}.md`, `DEVIATIONS.md` | `--plan general\|backend\|frontend`, `--update` | ready: repeats this session's plan-vs-code diff and refreshes `DEVIATIONS.md`; code wins on conflict |
| `/gifts-workshop:new-entity` | pattern shared by 9 entities: `schema.ts` → `repositories/interfaces.ts` + `drizzle/<x>Repository.ts` → `services/interfaces.ts` + `<x>Service.ts` → `controllers/<x>Controller.ts` → `container.ts` → `app/api/v1/<x>/route.ts` (+`[id]`) → `validation/schemas.ts` → RTK endpoints in `store/api.ts` → `system_texts` keys | `<name>`, `--localized-fields a,b`, `--public-read` | derive from code: most repetitive multi-file task in the repo; should also enforce the checks that are currently missed (status/visibility on public GET, proxy protection, `totalItems`) |
| `/gifts-workshop:i18n-sync` | `scratch_findKeys.mjs` (extracts `t('key')` per area), `pull-system-texts.js`, `migrations/seeds/runSystemTextsSeed.ts`, `initial-data/system-texts.json` | `--area admin\|public\|shared`, `--fix-seed` | update first: `pull-system-texts.js` writes to a stale path; the scanner is a scratch script; needs one agreed flow (scan keys → compare with `system_texts` → update JSON seed) |
| `/gifts-workshop:db-migration` | `drizzle.config.ts`, `schema.ts`, `src/migrations/sql`, `test:infra:*` scripts | `--generate`, `--check`, `--target dev\|test` | derive from code: `drizzle-kit generate` vs `push` (tests use push), FK `onDelete` policy, index per FK, journal consistency; there is currently no migrate step at deploy |
| `/gifts-workshop:design-check` | `.agents/rules/design.md`, `project-plan/colors.md`, `theme_design.md`, `globals.css`, `design.jpg` | `--target <path>`, `--area public\|admin` | update first: split out from `code-review` step 2; fix the `theme_colors.md` reference |
| `/gifts-workshop:dependency-audit` | `npm audit` output (run by the user), `package.json`, `PRODUCTION-READINESS.md` (Dependency vulnerabilities) | `--input <audit file>`, `--runtime-only` | derive from code: triage findings into runtime vs build-only (e.g. `shadcn` → hono/express chain), check whether an advisory applies to how the project uses the package, warn against `--force` fixes that downgrade (`minio`) |
| `/gifts-workshop:docs-sync` | `CLAUDE.md`, `DEVIATIONS.md`, `PRODUCTION-READINESS.md` | `--since <git ref>` | derive from code: after changes, re-verify statements in the docs against `src/` and update them |

## Suggested order

1. `api-exposure-check`, `security-audit`: they cover the release blockers and are cheap to run repeatedly.
2. `new-entity`, `architecture-check`: they keep new code within the layering.
3. `code-review` (after fixing stale references), `db-performance`, `deployment-validator`.
4. `i18n-sync`, `db-migration`, `requirements-check`, `design-check`, `docs-sync`, `frontend-standards`, `backend-standards`.

## Not skill candidates

- `.agents/rules/quota-rules.md`: AI token-economy notes for a previous tool; not a repeatable project process. Keep it as an agent-behavior note or drop it.
- `.agents/rules/workspace.md` ("do not run `npm install`, give the command to the user") and `system_rules.md` (plans/summaries process): agent-behavior policy; belongs in `CLAUDE.md` or permission settings, not in a skill.
- `tags_review.md`: content brainstorm for the tags seed, not a process.

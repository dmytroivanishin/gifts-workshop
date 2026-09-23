---
name: portfolio-docs-sync
description: Re-verifies statements in CLAUDE.md, DEVIATIONS.md, PRODUCTION-READINESS.md and AUDIT-SUMMARY.md against the current code after changes, and updates the docs that drifted. Use after code, schema, route, env or dependency changes, before a release, or when asked to sync or refresh the documentation.
argument-hint: "[--since <git ref>]"
allowed-tools: Read Grep Glob Edit Bash(git log *) Bash(git diff *) Bash(git status *) Bash(git show *)
---

# Portfolio Docs Sync

Keeps the generated documentation true. **The code is the source of truth**; the docs follow it. Scope of edits: `CLAUDE.md`, `DEVIATIONS.md`, `PRODUCTION-READINESS.md`, `AUDIT-SUMMARY.md`, `SKILL-CANDIDATES.md`, `CHANGE-PLAN.md`. This skill never edits `src/`, migrations, configs or `.agents/`.

## Trigger words

sync docs, update documentation, docs are stale, refresh CLAUDE.md, after my changes update the docs, обнови документацию, синхронизируй доки.

## Parameters

Arguments received: `$ARGUMENTS`

- `--since <git ref>`: compare against this commit/tag/date. Default: the commit that last touched `CLAUDE.md` (`git log -1 --format=%H -- CLAUDE.md`); if the docs are still uncommitted, use the docs' own "checked" dates and `git status`.

## Process

1. **Find what changed.** `git diff --stat <ref>..HEAD` plus `git status --short` (uncommitted work counts). Group the changed files by area.
2. **Map areas to doc claims** and re-verify each with `Grep`/`Read` (never trust the doc text):

   | Changed area | Claims to re-check |
   |--------------|--------------------|
   | `schema.ts`, `src/migrations/sql` | table list and columns (`CLAUDE.md` §5), table/index/migration counts (13 tables, 17 indexes, 1 migration), FK notes, `DEVIATIONS.md` → Database |
   | `src/app/api/v1/**`, `controllers`, `services` | access rules (§7), endpoint counts, `DEVIATIONS.md` → Backend, blockers B1–B4 status |
   | `src/proxy.ts`, `auth/**`, `utils/{auth,jwt,googleOAuth,rateLimit,paginationUtils}.ts` | §6 (guard rules, rate limits, login flow, cookies, refresh heuristic, dev-login), §2 pagination, B5–B7, B10 |
   | `modules/core/{container,env}.ts` | §2 wiring, §9 variable names and the count of required variables, B5, B9 |
   | `modules/storage` | §8 (sizes, formats, public URL, `ensureBucket()`), B9 |
   | `store/api.ts` | endpoint count (42 at last count), tag types |
   | `package.json`, lockfile | versions in §1, scripts in §3, dependency section |
   | `docker-compose*.yml`, Dockerfile, `next.config.ts` | §9, §12, deployment checklist (a Dockerfile appearing closes part of B8) |
   | tests, `vitest`/`playwright` config | testing statements in §3, §10, `DEVIATIONS.md` → Testing |
   | `src/app/**`, `components/**`, `i18n` | frontend status (§10), `DEVIATIONS.md` → Frontend/Design |

3. **Numbers that need execution are not guessed.** Lint counts, `npm audit` counts, `tsc` and build status come only from output the user provides (`.claude/command-output/` or a new paste). If code changed and no new output exists, mark the figure `(as of <date>, not re-verified)` and list the commands to run instead of inventing a number.
4. **Update the docs** with minimal edits: fix wrong statements, remove items that are fixed (move them to the "Fixed" row/table), add new findings with file references, keep the `[intentional]/[quality]/[gap]/[added]` vocabulary, update dates. Keep `CLAUDE.md` concise: names and rules, no secret values, no long histories.
5. **Cross-file consistency.** The same fact must read the same in `CLAUDE.md` §1/§11/§12, `PRODUCTION-READINESS.md`, `AUDIT-SUMMARY.md` and `DEVIATIONS.md` (blocker status, counts, decisions such as "Dockerfile is the chosen route").
6. **Change plan.** Reconcile `CHANGE-PLAN.md`: move answered/completed items to Done with the date, add new open items with the next `CP-n` ID, and remind the user of what still waits on them.
7. **Skills.** If routes, layers, entities or commands changed, check that the skills in `.claude/skills/portfolio-*` still describe reality (file names, counts, known-debt lists) and report the ones that need an edit; edit them only when the user asks.

## Output

1. **Doc changes made:** `file | section | before → after | evidence (file:line)`.
2. **Unverified items** and the exact commands the user should run to verify them.
3. **Drift you found but did not fix** (for example in `.agents/` or in skills), and why.

## Example usage

```
/portfolio-docs-sync
/portfolio-docs-sync --since HEAD~5
/portfolio-docs-sync --since 2026-09-19
```

---
name: gift-workshop-requirements-check
description: Compares the project plans in docs/project-plan with the current code and classifies every difference (intentional, quality, gap, added); optionally refreshes DEVIATIONS.md. Use when the plans or code changed, when asked what is implemented vs planned, or before writing new plan-driven work.
argument-hint: "[--plan general|backend|frontend] [--update]"
allowed-tools: Read Grep Glob Bash(git log *) Bash(git diff *)
---

# Gift Workshop Requirements Check

Repeats the plan-vs-code diff that produced `DEVIATIONS.md`. **The code wins**: plans are intent and may be stale. Read-only unless `--update` is passed.

## Trigger words

requirements check, plan vs code, what is missing from the plan, deviations, is feature X implemented, spec compliance, сверь с планом, что не реализовано, расхождения.

## Parameters

Arguments received: `$ARGUMENTS`

- `--plan general|backend|frontend` (default: all three): which file in `docs/project-plan/` to check (`general.md`, `backend.md`, `frontend.md`; `colors.md` and `theme_design.md` belong to `gift-workshop-design-check`; `diagram.jpg` = REST + DB schema, `design.jpg` = UI reference).
- `--update`: after the check, rewrite the affected entries in `DEVIATIONS.md` (only that file).

## Process

1. **Fixed decisions (never report as deviations):** the stack (Next.js route handlers instead of Express, Drizzle + PostgreSQL, Redux Toolkit); the `/api/v1` prefix; the endpoint table in `backend.md` is a valid *target*; access tokens in HttpOnly cookies; `PUT` for updates. State these up front so they are not re-litigated.
2. **Extract requirements.** Read the plan and list each concrete, checkable requirement (entity fields, endpoints, filters, behaviors, screens, validation rules, non-functional rules).
3. **Locate each in code.** Grep for the route in `src/app/api/v1`, the field in `schema.ts` / `src/types`, the screen in `src/app`, the rule in services. Open the file and confirm; never rely on memory or on `DEVIATIONS.md` alone, since it can be stale (compare its date with `git log -1 --format=%cs -- DEVIATIONS.md`, and look at `git log --since` for later code changes).
4. **Classify** with the tags used in `DEVIATIONS.md`:
   - `[intentional]`: different but valid approach; the plan is outdated;
   - `[quality]`: the code diverges from the project's own rules (`CLAUDE.md`'s Working Agreements, `docs/guidelines/*`, layering, contracts) and is a cleanup candidate;
   - `[gap]`: planned, not implemented;
   - `[added]`: in code, absent from the plans.
5. **Judge quality only against patterns the project itself defines** (layering, `BaseError`, Zod at the edge, response envelope, i18n rules); do not propose a different stack or architecture.
6. **Docs drift.** Note plan files that reference things that do not exist or no longer match the code (for example `docs/project-plan/backend.md` still describing Express) and record them under "Documentation drift". `docs/project-plan/*` is read-only plan history, not spec — do not edit it unless the user asks.
7. **With `--update`:** edit only the affected bullets of `DEVIATIONS.md`, keep the tag vocabulary and file references, update the verification date, and mention any status change in `CLAUDE.md` §1/§11 as a suggestion.

## Output

1. **Coverage summary:** counts per tag and per plan file.
2. **Table:** `requirement | plan ref | code ref (file:line) | tag | note`.
3. **Changes since the last `DEVIATIONS.md`:** items that became implemented, new gaps, removed/renamed items.
4. With `--update`: the list of edited entries. Nothing outside `DEVIATIONS.md` is written.

## Example usage

```
/gift-workshop-requirements-check
/gift-workshop-requirements-check --plan frontend
/gift-workshop-requirements-check --plan backend --update
```

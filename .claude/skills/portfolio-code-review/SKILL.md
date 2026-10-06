---
name: portfolio-code-review
description: Deep five-step code review of Portfolio changes (architecture, design/UX, TypeScript safety, clean code, security/performance). Use when the user asks to review a diff, a branch, a PR or a path, or says "review", "code review", "проверь код", "ревью".
argument-hint: "[--scope <path|diff>] [--area backend|frontend|all]"
allowed-tools: Read Grep Glob Bash(git diff *) Bash(git log *) Bash(git status *) Bash(git show *)
---

# Portfolio Code Review

Read-only review of code in this repository against the project's own rules. It reports findings with a suggested fix for each; it does not edit files. Originally ported from the project's `.agents/workflows/review.md` (5 steps; that file and the rest of `.agents/` were retired 2026-10-06, CP-34 — this skill is the living, corrected version), checked against the current code, which is the source of truth (`CLAUDE.md`, `DEVIATIONS.md`).

## Trigger words

review, code review, deep review, review my changes, review this PR, check this diff, проверь код, ревью, посмотри изменения.

## Parameters

Arguments received: `$ARGUMENTS`

- `--scope <path|diff>`: a file/folder to review, or `diff` for uncommitted + staged changes (default: `diff`; if the diff is empty, ask which path to review).
- `--area backend|frontend|all`: limits which steps apply (default: inferred from the files: `src/app/api`, `controllers`, `services`, `repositories`, `utils`, `modules` = backend; `src/app/**/page|layout`, `components`, `store`, `i18n` = frontend).

## Process

1. **Scope.** For `diff`, run `git status --short` and `git diff HEAD` (add `--stat` first for size). Read every changed file in full, not only the hunks: most rules need the surrounding code. Tag each file backend / frontend / shared.
2. **Step 1: Architectural alignment.** Load `.claude/skills/portfolio-architecture-check/SKILL.md` and apply its checks to the scope (layer boundaries, container wiring, no server code in client components).
3. **Step 2: Design and UX** (frontend files only). Apply the checklist from `.claude/skills/portfolio-design-check/SKILL.md`. Note: the tokens live in `docs/project-plan/colors.md`, `docs/project-plan/theme_design.md` and `src/app/globals.css`.
4. **Step 3: TypeScript and type safety** (source: `CLAUDE.md`'s Working Agreements).
   - Zero `any`; `unknown` plus type guards for dynamic values. `catch (error: any)` and `body: any` exist in old code: flag them only when the change adds or touches them.
   - Explicit return types on every function and method.
   - `interface` for object shapes, `type` for unions and aliases, `as const` objects instead of `enum`.
   - Every external input (request body, query and path params, env, `localStorage`, third-party responses) is parsed with Zod before it is cast. `request.json()` results must go through `validateRequest`.
   - `Pick` / `Omit` / `Partial` / `Readonly` instead of copied shapes.
5. **Step 4: Clean code and functional style.**
   - `.map` / `.filter` / `.reduce` over `for` / `while`; no mutation of arguments or state (spread or `const`).
   - One function = one action; split anything whose description needs "and".
   - Descriptive names; comments explain "why", never "what".
   - Errors: `BaseError` subclasses on the backend, one try/catch at the entry level.
6. **Step 5: Security and performance.**
   - Security: cookies stay HttpOnly + SameSite=Strict (+ `Secure` in production); nothing reads tokens from JS; the OAuth flow keeps its checks (`state` + PKCE, the fixed server-side redirect address, `verifyGoogleIdToken` with issuer, `aud` and `email_verified`; see `utils/googleOAuth.ts`); every new endpoint has a deliberate access decision, and a new public or expensive route also gets a rule in `resolveRateLimitRule` (`proxy.ts`); list controllers use `getPaginationParams` and do not parse `page`/`limit` themselves. `src/proxy.ts` protects by HTTP method plus one path rule (every method on `/api/v1/users/**` and `/api/v1/admin/**`); every other `GET` is public, so any new `GET` that returns admin data or unpublished content (without the `utils/postVisibility.ts` rule for posts, or a field allowlist in the repository) is a HIGH finding. No raw `error.message` in responses (`sendError` already returns a generic message for unexpected errors; keep it so); no `console.*` (use `logger` from `@/modules/logger`); no secrets in code or docs.
   - Performance: `next/image` and `next/font` instead of raw `<img>` and CSS `@import`; no `import * as` from icon libraries; `useMemo` / `useCallback` only where a heavy tree or store transform justifies it; list queries load partial relations only (as `PostRepository.getListRelations()` does) and are paginated; no N+1 inside `populate()`; images have dimensions (layout shift).
7. **Separate new from old.** For each finding decide: *introduced by this change* or *pre-existing* (listed in `DEVIATIONS.md` or `PRODUCTION-READINESS.md`). Pre-existing items are reported in one short list at the end, not as blockers, unless the scope is a whole folder.
8. **Verify claims.** Before reporting a finding, re-open the file and confirm the line. Never cite code from memory.
9. Optionally suggest (do not run without the user's go-ahead) `npx tsc --noEmit` and `npx eslint <changed files>`. Do not use the repo-wide `npm run lint`: it is red (345 errors on 2026-09-23) and hides new problems.

## Output

A report in the user's language (code, identifiers and paths stay as written):

1. **Verdict:** approve / approve with comments / changes requested, in one line.
2. **Findings**, most severe first (`HIGH` / `MEDIUM` / `LOW`). For each: `path:line`, the rule (which step), why it matters, and a concise code snippet with the suggested fix.
3. **Pre-existing debt seen in the scope** (one line each, with a pointer to `DEVIATIONS.md`).
4. **Not reviewed** (files skipped, behavior not run).

No files are modified.

## Example usage

```
/portfolio-code-review
/portfolio-code-review --scope src/controllers/postController.ts --area backend
/portfolio-code-review --scope src/app/admin/collections --area frontend
```

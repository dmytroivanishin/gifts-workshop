---
name: gifts-workshop-dependency-audit
description: Triages npm audit output for the Gifts Workshop app into runtime vs build-only, checks whether each advisory applies to how the project uses the package, and produces a safe one-step-at-a-time upgrade plan (never npm audit fix --force). Use when the user pastes npm audit output, asks about vulnerabilities/outdated packages, or before a release.
argument-hint: "[--input <audit file>] [--runtime-only]"
allowed-tools: Read Grep Glob Bash(git log *) Bash(npm ls *)
---

# Gifts Workshop Dependency Audit

**Claude does not run `npm audit`, `npm install`, `npm outdated` or any network/dependency command in this repo.** The user runs them and pastes the output (previous results are in `.claude/command-output/`, for example `.claude/command-output/npm_audit.md`). This skill turns that output into decisions. `npm ls <pkg>` is local and read-only, so it may be used to see why a package is installed.

## Trigger words

npm audit, vulnerabilities, CVE, advisory, outdated packages, dependency upgrade, is this package safe, `fix` for audit, уязвимости зависимостей, обнови зависимости.

## Parameters

Arguments received: `$ARGUMENTS`

- `--input <audit file>`: path to the pasted output (default: the newest file matching `.claude/command-output/*audit*`; if none, print the commands below and stop).
- `--runtime-only`: report only findings that reach the running app.

## Process

1. **Get the input.** If there is none, ask the user to run and paste (from the repo root):
   ```bash
   npm audit
   npm audit --omit=dev     # what ships at runtime
   npm ls next sharp shadcn   # optional, why they are installed
   ```
   Check the date/versions in the file against `package.json` and `package-lock.json`; if the lockfile is newer than the file, ask for a fresh run.
2. **Parse findings:** package, severity, advisory id (GHSA/CVE), vulnerable range, installed version, fixed version, `fixAvailable` and whether the fix is a semver-major or a downgrade.
3. **Classify each:**
   - **Runtime**: appears in `npm audit --omit=dev` and the package is imported by shipped code (`next`, `react`, `sharp`, `jose`, `drizzle-orm`, `postgres`, `zod`, `winston`, …).
   - **Build/dev only**: dev tooling or a CLI that is not needed at runtime (`eslint*`, `typescript`, `tailwindcss` toolchain, `postcss`, the `shadcn` CLI and its transitive `hono` / `express` / `body-parser` / `qs` chain). Check `package.json` for CLIs sitting in `dependencies` (the `shadcn` CLI is; `src/app/globals.css` imports `shadcn/tailwind.css`, which is build-time only, so it can move to `devDependencies`).
4. **Check applicability** for runtime findings by reading how the project uses the package: does the vulnerable feature exist in this app? Examples of questions: does the advisory need Server Actions (`"use server"`), rewrites/redirects in `next.config.ts`, the `i18n` config, Windows, the image optimizer (`/_next/image` is on by default; `next/image` is used in 2 files), Turbopack; does `sharp` only process admin-uploaded images; does `minio` only talk to our own server. A finding is `applies`, `does not apply (reason + evidence)` or `unknown`. Unknown stays unknown: do not guess. Fetch an advisory page from the internet only when the user has allowed it (tracked as CP-1 for GHSA-6gpp-xcg3-4w24, the Next Middleware/Proxy bypass: `src/proxy.ts` is the only auth gate, so treat it as applicable until confirmed).
5. **Judge the suggested fix.** Reject fixes that downgrade or break: the audit's suggestion for a transitive chain may install an older major (a downgrade): refuse it and accept the risk explicitly (the client only talks to our own MinIO) or wait for an upstream release. **Never recommend `npm audit fix --force`.**
6. **Plan the upgrade, one step per command, rebuilding in between.** The 2026-09-19 round (`next`/`sharp`/`shadcn`) was completed 2026-10-05: `next` → 16.3.8 (not the originally-planned 16.3.5 — a new critical advisory in `next/og`'s `ImageResponse` had appeared in that range by the time it ran, so the trivial same-minor patch was taken too), `sharp` → 0.35.4, `eslint-config-next` → 16.3.8, `shadcn` → `devDependencies`; `npm audit --omit=dev` is now 0 critical/high, 5 moderate (already-known: `baseline-browser-mapping` bundled inside `next` itself, build-time only; the `minio` chain, accepted). That round's findings table and plan are history now (see `CHANGE-PLAN.md` → Done → CP-2); a fresh invocation of this skill starts from new pasted `npm audit` output, not from that plan. Keep the general method: one step per command, rebuild in between, never recommend `npm audit fix --force`, and check that `next` stays pinned exactly in `package.json` (a Next minor bump can change behavior — read the release notes/`node_modules/next/dist/docs/` for `proxy.ts`, image and caching changes before recommending one).
7. **Define done:** `npm audit --omit=dev` shows no critical/high finding that applies at runtime and the build passes (this was the definition in `CHANGE-PLAN.md` CP-2, now Done).
8. **Follow-up** when the user pastes new output: update counts and status in `PRODUCTION-READINESS.md`, `CLAUDE.md` §1/§11 and `AUDIT-SUMMARY.md`, and move CP-2 to Done in `CHANGE-PLAN.md` (docs only; ask before editing).

## Output

1. **Counts:** total / critical / high / moderate / low, split runtime vs build-only.
2. **Findings table:** `package | installed → fixed | severity | advisory | scope (runtime/build) | applies? (evidence) | action`.
3. **Ordered upgrade plan** (one command per step, expected result, what to verify), plus what to paste back.
4. **Accepted risks** with the reason each is accepted.

No dependency, lockfile or code change is made by this skill.

## Example usage

```
/gifts-workshop-dependency-audit
/gifts-workshop-dependency-audit --input .claude/command-output/npm_audit.md --runtime-only
```

# CHANGE-PLAN.md

Running list of open steps for this repo. It is imported into `CLAUDE.md`, so it is loaded at the start of every session. Keep it short.

**Rules for Claude**
- At the start of a session, and before starting new work, remind the user of every open item in "Waiting on the user": say the item ID and exactly what is needed.
- When the user supplies an output or an answer, do the follow-up listed under the item, update the affected docs, then move the item to "Done" with the date.
- Docs-only phase: no changes to `src/`, migrations or configs unless the user explicitly asks. Network/dependency commands are run by the user.
- New steps go here with an ID (`CP-n`), an owner, and a definition of done. The broader backlog lives in `AUDIT-SUMMARY.md` ("Next steps") and `PRODUCTION-READINESS.md`.

## Waiting on the user

### CP-1 · Check the Next.js proxy-bypass advisory (added 2026-09-19)
- **Need:** read advisory GHSA-6gpp-xcg3-4w24 ("Middleware / Proxy bypass in App Router applications using Turbopack and single locale") and tell Claude whether its conditions match this app. Alternatively, tell Claude to look it up itself.
- **Why it matters:** `src/proxy.ts` is the only guard for `/admin/*` and for every write endpoint (blocker B10 in `PRODUCTION-READINESS.md`). This project has no `i18n` block in `next.config.ts` and does its own `[locale]` routing in `proxy.ts`, so it may not match, but that cannot be confirmed offline.
- **Follow-up (Claude):** set B10's applicability to confirmed / not applicable in `PRODUCTION-READINESS.md`, `CLAUDE.md` §11 and `AUDIT-SUMMARY.md`.

### CP-2 · Upgrade dependencies, then re-verify (added 2026-09-19)
- **Need:** run the upgrade plan in `PRODUCTION-READINESS.md` → "Dependency vulnerabilities" (you run it, one step at a time, rebuilding in between): `npm install next@16.3.5 eslint-config-next@16.3.5`, `npm install sharp@0.35.4`, `npm audit fix` (never `--force`, it downgrades `minio`), move `shadcn` to `devDependencies`, manually test login and an image upload.
- **Then send:** the output of `npm audit --omit=dev` and of `scripts/run.sh build`. Either paste it in chat or save it in `.claude/command-output/` (for example `npm_audit_omit_dev.md`, `build.md`) and tell me the file names. Keep the pre-upgrade `npm_audit.md` there until this item is done: it is the only record of the 63 advisory ids before the upgrade.
- **Follow-up (Claude):** update the audit counts, the build/lint status and B10 in `PRODUCTION-READINESS.md`, `CLAUDE.md` (§1, §11) and `AUDIT-SUMMARY.md`.
- **Done when:** `npm audit --omit=dev` shows no critical/high findings that apply at runtime, and the build passes.

## Waiting on Claude

_(none)_

## Done

_(none yet)_

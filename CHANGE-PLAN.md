# CHANGE-PLAN.md

Running list of open steps for this repo. It is imported into `CLAUDE.md`, so it is loaded at the start of every session. Keep it short.

**Rules for Claude**
- At the start of a session, and before starting new work, remind the user of every open item in "Waiting on the user": say the item ID and exactly what is needed.
- When the user supplies an output or an answer, do the follow-up listed under the item, update the affected docs, then move the item to "Done" with the date.
- Code changes only for points the user has approved, one point at a time, stopping after each. No changes to migrations or configs unless the user explicitly asks. Network/dependency commands are run by the user.
- New steps go here with an ID (`CP-n`), an owner, and a definition of done. The broader backlog lives in `AUDIT-SUMMARY.md` ("Next steps") and `PRODUCTION-READINESS.md`.

## Waiting on the user

### CP-2 · Upgrade dependencies, then re-verify (added 2026-09-19)
- **Need:** run the upgrade plan in `PRODUCTION-READINESS.md` → "Dependency vulnerabilities" (you run it, one step at a time, rebuilding in between): `npm install next@16.3.5 eslint-config-next@16.3.5`, `npm install sharp@0.35.4`, `npm audit fix` (never `--force`, it downgrades `minio`), move `shadcn` to `devDependencies`, manually test login and an image upload. Check first that the versions exist: `npm view next@16.3.5 version`. (`next@16.2.11` would fix only the proxy-bypass advisory, see CP-1; the audit lists 16.3.5 for all 11 Next advisories.)
- **Then send:** the output of `npm audit --omit=dev` and of `scripts/run.sh build`. Either paste it in chat or save it in `.claude/command-output/` (for example `npm_audit_omit_dev.md`, `build.md`) and tell me the file names. Keep the pre-upgrade `npm_audit.md` there until this item is done: it is the only record of the 63 advisory ids before the upgrade.
- **Follow-up (Claude):** update the audit counts, the build/lint status and B10 in `PRODUCTION-READINESS.md`, `CLAUDE.md` (§1, §11) and `AUDIT-SUMMARY.md`. After this, ask whether to start CP-5.
- **Done when:** `npm audit --omit=dev` shows no critical/high findings that apply at runtime, and the build passes.

### CP-4 · Verify the B1–B6 fixes by hand (added 2026-09-19)
- **Need:**
  1. Log in to `/admin` and open the comments page: the list must load.
  2. Logged out (or a private window): `/api/v1/users` and `/api/v1/admin/comments` answer 401; `/api/v1/posts?status=Draft` returns only published posts; `/ru/projects/<draft-slug>` shows "not found" and the draft title is not in `<title>`.
  3. Logged in as admin: a draft is on the dashboard, opens in the editor and by its public URL.
  4. Run `scripts/run.sh build` and `npm run lint` and send the output (paste it, or save it in `.claude/command-output/`), so the counts can be refreshed. Nothing was built or linted after the changes; only `tsc --noEmit` was run.
  5. Decide: add a mock `JWT_SECRET=<mock>` line to the tracked `config/test.env`? `env.ts` now requires it and any test run that imports it would fail (no tests exist yet).
- **Follow-up (Claude):** mark B1–B6 verified in `PRODUCTION-READINESS.md`, `CLAUDE.md` §11 and `AUDIT-SUMMARY.md`; refresh the build/lint status; edit `config/test.env` if you say yes.
- **Done when:** checks 1–3 pass and the build is green.

## Deferred (decided later)

### CP-5 · Second authorization layer for writes
- `requireAdmin()` built on `verifyToken`, called in every write controller, so a bypass of `proxy.ts` does not open the API (today only the media upload checks). Decided 2026-09-19: after the Next upgrade (CP-2).

### CP-6 · Smaller follow-ups (not decided)
- 400/404 for malformed JSON and non-UUID ids, and a cap for `limit` (you chose the message-only fix for B4 for now).
- Admin dashboard after the access token expires (15 min): it silently lists only published posts. Fix idea: the dashboard sends an explicit `status=all` and the server answers 401 for it without a token.
- Public `GET /media` lists every file, including images of unpublished posts.
- `CommentService.replyToComment` throws a plain `Error("Parent comment not found")` (a 500); it should be a `NotFoundError`.
- `POST /users` cannot succeed for a new user (`users.password` is NOT NULL and the service never sets it).

## Waiting on Claude

_(none)_

## Done

- **CP-1 · Check the Next.js proxy-bypass advisory (2026-09-19).** GHSA-6gpp-xcg3-4w24 (shown as CVE-2026-64642), affects `next >=16.0.0 <16.2.11`, patched in 16.2.11. Condition as written: an App Router build with Turbopack **and a single entry in `config.i18n.locales`**. This app has an empty `next.config.ts` (no `i18n` block), so it most likely does not apply. Caveats: the page does not describe the mechanism, and 16.2.6 is in the vulnerable range anyway, so the upgrade (CP-2) is still needed for the other advisories. Recorded in `PRODUCTION-READINESS.md` (B10), `CLAUDE.md` §11 and `AUDIT-SUMMARY.md`.
- **CP-3 · Fix B1–B6 in code (2026-09-19).** Anonymous reads of `/users/**` and `/admin/**` closed, `password` no longer returned, unpublished posts hidden from anonymous readers (API and page metadata), generic 500 message, `JWT_SECRET` required, dev-login refuses production. `tsc --noEmit` clean. Files: `AUDIT-SUMMARY.md` → "Fixes applied". Verification by hand is CP-4.

# CHANGE-PLAN.md

Running list of open steps for this repo. It is imported into `CLAUDE.md`, so it is loaded at the start of every session. Keep it short.

**Rules for Claude**
- At the start of a session, and before starting new work, remind the user of every open item in "Waiting on the user": say the item ID and exactly what is needed.
- When the user supplies an output or an answer, do the follow-up listed under the item, update the affected docs, then move the item to "Done" with the date.
- Code changes only for points the user has approved, one point at a time, stopping after each. No changes to migrations or configs unless the user explicitly asks. Upgrades of existing dependencies and `npm audit` are run by the user; adding a new package follows the rules in `CLAUDE.md` (Working agreements → Dependencies).
- New steps go here with an ID (`CP-n`), an owner, and a definition of done. The broader backlog lives in `AUDIT-SUMMARY.md` ("Next steps") and `PRODUCTION-READINESS.md`.

## Waiting on the user

### CP-2 · Upgrade dependencies, then re-verify (added 2026-09-19)
- **Need:** run the upgrade plan in `PRODUCTION-READINESS.md` → "Dependency vulnerabilities" (you run it, one step at a time, rebuilding in between): `npm install next@16.3.5 eslint-config-next@16.3.5`, `npm install sharp@0.35.4`, `npm audit fix` (never `--force`, it downgrades `minio`), move `shadcn` to `devDependencies`, manually test login and an image upload. Check first that the versions exist: `npm view next@16.3.5 version`. (`next@16.2.11` would fix only the proxy-bypass advisory, see CP-1; the audit lists 16.3.5 for all 11 Next advisories.)
- **Then send:** the output of `npm audit --omit=dev` and of `scripts/run.sh build`. Either paste it in chat or save it in `.claude/command-output/` (for example `npm_audit_omit_dev.md`, `build.md`) and tell me the file names. Keep the pre-upgrade `npm_audit.md` there until this item is done: it is the only record of the 63 advisory ids before the upgrade.
- **Baseline moved (2026-09-23):** after adding `rate-limiter-flexible` (no dependencies, not in any advisory) `npm audit` reports 28 findings (1 critical, 10 high, 14 moderate, 3 low), up from 20 on 2026-09-19. The 8 extra package names are dev tooling with newly published advisories: `vitest`, `@vitest/ui`, `@vitest/mocker`, `esbuild`, `@esbuild-kit/*`, `drizzle-kit` (via esbuild) and `undici` (high, only via `jsdom`; `npm ls undici --omit=dev` is empty). Saved: `.claude/command-output/npm_audit_2026-09-23.json`. The 20 in the docs are outdated; the number that matters for "Done when" is `npm audit --omit=dev`.
- **Follow-up (Claude):** update the audit counts, the build/lint status and B10 in `PRODUCTION-READINESS.md`, `CLAUDE.md` (§1, §11) and `AUDIT-SUMMARY.md`. After this, ask whether to start CP-5.
- **Done when:** `npm audit --omit=dev` shows no critical/high findings that apply at runtime, and the build passes.

### CP-4 · Verify the B1–B6 fixes by hand (added 2026-09-19)
- **Need:**
  1. Log in to `/admin` and open the comments page: the list must load.
  2. Logged out (or a private window): `/api/v1/users` and `/api/v1/admin/comments` answer 401; `/api/v1/posts?status=Draft` returns only published posts; `/ru/projects/<draft-slug>` shows "not found" and the draft title is not in `<title>`.
  3. Logged in as admin: a draft is on the dashboard, opens in the editor and by its public URL.
  4. Run `npm run lint` and send the output (paste it, or save it in `.claude/command-output/`), so the counts can be refreshed. The build was run by Claude on 2026-09-23 with the B1–B6, sitemap and rate-limit changes: it passes (exit 0, `/sitemap.xml` is dynamic, the proxy bundles with `rate-limiter-flexible`), output in `.claude/command-output/build_2026-09-23.md`. Note `scripts/run.sh` is not executable, so use `bash scripts/run.sh build`.
  5. Decide: add a mock `JWT_SECRET=<mock>` line to the tracked `config/test.env`? `env.ts` requires it and any test run that imports it would fail (no tests exist yet). An `S3_PUBLIC_URL` line has appeared in that file (2026-09-23, not written by Claude, so presumably you); `JWT_SECRET` is still missing there.
- **Partly checked by Claude (2026-09-23)** against a local `next start` with a locally minted admin token: the comments list loads (12 comments), `/api/v1/users` and `/api/v1/admin/comments` answer 401 to anonymous callers, infinite scroll works on the public page, dashboard, tags and comments. The dev DB has no drafts and the real Google login was not run, so checks 2 (draft part) and 3 still need you.
- **Follow-up (Claude):** mark B1–B6 verified in `PRODUCTION-READINESS.md`, `CLAUDE.md` §11 and `AUDIT-SUMMARY.md`; refresh the build/lint status; edit `config/test.env` if you say yes.
- **Done when:** checks 1–3 pass and the build is green.

## Deferred (decided later)

### CP-5 · Second authorization layer for writes
- `requireAdmin()` built on `verifyToken`, called in every write controller, so a bypass of `proxy.ts` does not open the API (today only the media upload checks). Decided 2026-09-19: after the Next upgrade (CP-2).

### CP-8 · Production: choose the public MinIO address and set `S3_PUBLIC_URL` (added 2026-09-23; blocked, no domain or server yet)
- Uploads store the full image URL in the database, built from `S3_PUBLIC_URL`. The variable is required everywhere (`env.ts` refuses to start without it, there is no fallback to `S3_ENDPOINT`). In production set it when the address is known, for example `https://media.<domain>` (the value is the MinIO root, the bucket name is appended).
- The address must be stable: changing it later means rewriting the stored URLs (`UPDATE media SET original_url = replace(original_url, '<old>', '<new>'), thumbnail_url = replace(thumbnail_url, '<old>', '<new>')`). Coolify's temporary generated domain is a poor choice for this reason.
- Locally the value is the same as `S3_ENDPOINT` (`config/local.env` already has it).

### CP-6 · Smaller follow-ups (not decided)
- 400/404 for malformed JSON and non-UUID ids (you chose the message-only fix for B4 for now). The `limit` cap is done (100 maximum).
- Admin dashboard after the access token expires (15 min): it silently lists only published posts. Fix idea: the dashboard sends an explicit `status=all` and the server answers 401 for it without a token.
- Public `GET /media` lists every file, including images of unpublished posts.
- `CommentService.replyToComment` throws a plain `Error("Parent comment not found")` (a 500); it should be a `NotFoundError`.
- `POST /users` cannot succeed for a new user (`users.password` is NOT NULL and the service never sets it).
- `MediaService.deleteMedia` deletes only the database row; the two objects (original and thumbnail) stay in the bucket forever. Fix: remove them from MinIO too, deriving the object names from the stored URLs (media rows can also hold external URLs, so skip those).
- `S3_FORCE_PATH_STYLE` is in the required env list but nothing reads it (the `minio` client is configured from `S3_ENDPOINT` alone). Drop it from the list or use it.

## Waiting on Claude

### CP-7 · Infinite scroll: stop the extra empty-page request (to do; deferred by the user on 2026-09-23)
- **Problem:** after the last page arrives the client sends one more request for an empty page (`page=4` when 5 items load 2 at a time). The server is correct (`limit + 1`, last page answers `nextPage: null`); the client keeps `hasMore` in `useState`, updated by a separate `useEffect`, so for about 13 ms after the response the loader is still mounted and observed and the IntersectionObserver fires once more. Harmless (empty list, the merge de-duplicates) but wasteful. Seen on the public page and the dashboard; tags and comments have the same pattern but did not show it because their loader leaves the viewport.
- **Fix:** derive `hasMore` during render from `response.meta.nextPage` (`!= null`) and delete the `useState` and the sync effect. Files: `src/app/[locale]/(public)/page.tsx`, `src/app/admin/dashboard/page.tsx`, `src/app/admin/tags/page.tsx`, `src/app/admin/comments/page.tsx`; `src/app/admin/localizations/page.tsx` already derives it.
- **Start:** after points 8 and 10 and the docs pass; ask before touching these files.
- **Done when:** in a browser, scrolling to the end sends no request beyond the last page (check with a small forced `limit`), and `next build` passes.

## Done

- **CP-1 · Check the Next.js proxy-bypass advisory (2026-09-19).** GHSA-6gpp-xcg3-4w24 (shown as CVE-2026-64642), affects `next >=16.0.0 <16.2.11`, patched in 16.2.11. Condition as written: an App Router build with Turbopack **and a single entry in `config.i18n.locales`**. This app has an empty `next.config.ts` (no `i18n` block), so it most likely does not apply. Caveats: the page does not describe the mechanism, and 16.2.6 is in the vulnerable range anyway, so the upgrade (CP-2) is still needed for the other advisories. Recorded in `PRODUCTION-READINESS.md` (B10), `CLAUDE.md` §11 and `AUDIT-SUMMARY.md`.
- **CP-3 · Fix B1–B6 in code (2026-09-19).** Anonymous reads of `/users/**` and `/admin/**` closed, `password` no longer returned, unpublished posts hidden from anonymous readers (API and page metadata), generic 500 message, `JWT_SECRET` required, dev-login refuses production. `tsc --noEmit` clean. Files: `AUDIT-SUMMARY.md` → "Fixes applied". Verification by hand is CP-4.
- **CP-9 · `S3_PUBLIC_URL` in `config/local.env` (2026-09-23).** Added by you. Claude ran the one-time upload check you allowed (dev server via `scripts/run.sh dev`, a PNG through the admin media page's file input): the stored URLs start with `S3_PUBLIC_URL/<bucket>/`, both open with HTTP 200 as `image/png` (1000x643 and 320x206), the media library shows the image, and the database row holds the same URLs. The test row and both objects were removed afterwards. The permission was for that single run; repeating it needs a new go-ahead.

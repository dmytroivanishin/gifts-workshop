# Backlog — flat reference list

This is a **reading view**, not a second source of truth. The real record, with full
detail, history and "Done" writeups, is `CHANGE-PLAN.md` (auto-loaded into every
session via `CLAUDE.md` §14) — this file just lays out every `CP-n` in one place,
grouped by what it takes to start, so you can say "бери CP-23" and I know exactly
what that means without you having to scroll `CHANGE-PLAN.md`.

Generated 2026-10-05 from `CHANGE-PLAN.md`, `PRODUCTION-READINESS.md` and
`DEVIATIONS.md`; refreshed 2026-10-12. If these docs change later, this file can
drift — ask me to regenerate it rather than trusting it blindly after a long gap.

---

## 🔴 Waiting on you (nothing to pick here — I need an answer/action first)

- **CP-4** — log in by hand and check B1–B6 in the browser; decide whether to add a mock `JWT_SECRET` to `config/test.env`; also now covers a real Google login + browser image upload against the upgraded `next`/`sharp` (former CP-2 manual-verification step — Google OAuth can't be scripted).

## 🟢 Ready to pick right now — pure code, no migration/config/dependency

- **CP-32** — design visual-language audit (`/portfolio-design-check`, read-only, then report what's off). Postponed by you 2026-10-12 — technically ready, just not scheduled.

## 🟡 Needs your explicit "да" first (migration / config / new dependency)

- **CP-33** — strict, nonce-based CSP (`next.config.ts` + `proxy.ts` architecture change — wants a plan first, not just a go-ahead). Postponed by you 2026-10-12, no active vulnerability today (no `dangerouslySetInnerHTML`/`innerHTML` in `src/`).

## 🔵 Big pieces — want a scoping conversation before any code, not a quick fix

- **CP-17** — SEO/metadata review (includes the bigger item: server-rendering post content for SEO, today fully client-fetched).
- **CP-18** — code-standard pass: lint cleanup (378 problems, mostly `any`). Four of its five parts done/decided 2026-10-12 (`TagService.deleteTag` dead code, `media.orientation` casing, `withErrorHandling` wrapper, `console.*`-in-client-components left as a permanent decision) — see "Done" below; only the big lint/`any` sweep is still open.
- **CP-19** — real `README.md` + completeness pass across the generated docs.
- **CP-25** — deployment bundle: Dockerfile, health endpoint, migration/rollback strategy, HSTS, rate-limit-at-the-edge decision, swapping dev credentials, backups (this is blocker B8). **Now also carries CP-24** (seed the lookup tables as part of the same first-boot migration step, not a separate loader script) **and CP-8** (set the real `S3_PUBLIC_URL`, not a Coolify temporary domain, in this same first deploy) — merged in 2026-10-12 at your request.
- **CP-31** — testing infrastructure from scratch (no vitest/playwright config or specs exist at all today).
- **CP-35** — general control-flow/structural code-quality pass: flatten nested `if`/`for`/`while` into guard clauses, remove redundant conditions, apply design patterns only where they'd remove real duplication. Distinct from CP-18 (typing/lint/logging). Raised 2026-10-12, needs a scan before picking what's worth touching.
- **CP-30** — planned-but-unbuilt **features** (multi-select category filter, Archive view with restore, profile editing, SEO settings page, `Language` table) — kept separate from the fix/quality queue per your decision (2026-10-05); only start on these if you explicitly ask.

## ⚪ Parked / declined — not on the active queue

- **CP-29** — `users.password` placeholder design decision. Closed 2026-10-12, no action: your call is that keeping the placeholder is fine (leaves room for a real password or Google-account linking later), and there's no risk since it's never returned and nothing treats it as a real credential today.
- **CP-28** — "premature refresh" token-family revocation heuristic. Presented twice (2026-09-28, 2026-10-01), declined both times. Listed only so it isn't silently forgotten.
- **CP-22** — real DB-level FK constraints on `categories.parent_id`/`comments.reply_id`. Declined 2026-10-06 — the app-level existence/cycle checks already in place are considered sufficient.
- **CP-16a** — `next.config.ts`: `experimental.proxyClientMaxBodySize`. Declined 2026-10-06 — upload UI sends one file per request, so no request should need to exceed 10 MB in normal use.
- **CP-27** — Redis-backed rate limiter. Declined 2026-10-06 — no more than one app instance planned for the foreseeable future.

## ✅ Done (brief — full detail and file lists are in `CHANGE-PLAN.md` → "Done")

CP-1, CP-3, CP-7, CP-9, CP-10, CP-11, CP-12, CP-13, CP-14, CP-15, CP-20, CP-21 — six rounds of small fixes (2026-09-19 through 2026-10-05) covering: anonymous-read blockers B1–B6, rate limiting, security headers, OAuth hardening (`state`+PKCE+verified ID token), dynamic sitemap, `S3_PUBLIC_URL`, media-list auth gate, dashboard `status=all`, upload MIME hardening, dead-code removal (`/users` writes), `token_sessions` purge, search escaping, `replyId`/email-allowlist checks, `adminWrite` rate limit, malformed-JSON/non-UUID handling, repository-bypass fixes, shared `issueSession()`, `next/image` on the public gallery, `parentId` existence check, `lucide-react` tree-shaking, `DrizzleDatabase` singleton on `globalThis`, search-by-description, and self-hosted fonts via `next/font`.

- **CP-2 (2026-10-05, one-off exception — you run upgrades normally).** `next` → 16.3.8, `sharp` → 0.35.4, `eslint-config-next` → 16.3.8, `shadcn` → `devDependencies`. `npm audit --omit=dev`: 0 critical/high, 5 moderate (all accepted). Manual Google-login + upload check still needs you (folded into CP-4).
- **CP-26 (2026-10-05).** `system_texts` cached via `unstable_cache`, invalidated on admin edit via `revalidateTag`.
- **CP-5 (2026-10-06).** Second, independent auth check on every write route (`withAdminAuth()` in `route.ts`, not in controllers — moved there after you pushed back on controllers knowing about auth).
- **CP-6 (2026-10-06).** `resolveStatusFilter` readability checked — already clean, no change needed. `GET /collections/:id/posts` double-wrap fixed (was nesting an already-wrapped `{data,meta}` object inside `sendSuccess`'s own wrapping).
- **CP-34 (2026-10-06).** `.agents/` retired — the project plan and reference material moved to `docs/`, stale/obsolete rule files deleted, nothing kept that CLAUDE.md didn't already supersede. Also deleted: `scratch_findKeys.mjs`, `pull-system-texts.js`, `tags_review.md`, `audit_results.md`, `report.md`, boilerplate `public/*.svg`/`old.*.png`.
- **CP-23 (2026-10-12).** `Cache-Control` on public list/read GETs: `categories`/`collections`/`tags`/`colors`/`system-texts` unconditionally (60s, named constant `CACHE_SECONDS.lookup`); `posts` (list, by-id, `collections/:id/posts`) at 30s but only for non-admin callers, decided in the controller (not inside the generic `sendSuccess` helper), since an admin's response can include Draft/Archived posts a shared cache must never leak to the next anonymous caller.
- **CP-16b (2026-10-12).** `POST /media` narrowed to exactly one file per request (`uploadMedia`, not `uploadMultiple`) — the admin media page was already the endpoint's only caller and already sent one file per request, so this closes a dormant bug where a multi-file request failing partway through silently dropped already-saved rows from its response, by removing the path entirely rather than patching it; `MAX_FILES_PER_UPLOAD` removed with it. Admin media page now also lists filenames that failed to upload, under the drop zone, reset each new batch. Same day, on your go-ahead: the page's raw-`fetch` calls were replaced with RTK Query (`uploadMedia`/`deleteMedia` mutations, `getMedia` finally used) — grid now refetches itself via tag invalidation instead of hand-rolled local state. Also same day: the file-count cap came back as a client-side guard (`NEXT_PUBLIC_MAX_FILES_PER_UPLOAD`, defaults to 30) against `RATE_LIMITS.upload`, since the server no longer has a batch request to cap.
- **CP-18, four of five parts (2026-10-12).** `TagService.deleteTag`'s manual category-cleanup loop removed — `categories_to_tags.tag_id`'s `ON DELETE CASCADE` already handled it (verified live: linked/deleted a disposable tag via the real API, the join row and the category's `tagsIds` both dropped it automatically). `media.orientation` now stored capitalized (`'Landscape'`/`'Portrait'`) matching the Zod enum/type, instead of lowercase with a silently-lying type cast; 4 existing dev-DB rows normalized too, on your go-ahead. `withErrorHandling(handler)` wrapper added (`apiResponse.ts`) and applied to all 9 controllers — every method is now `methodName = withErrorHandling(async (...) => {...})` instead of its own `try/catch`; confirmed all 36 catch blocks were identical before removing them. Lint dropped 415 → 378 problems as a side effect. `console.*` in the ~34 client-component call sites: decided (no code) to leave it permanently — winston can't run in the browser and there's no error-reporting infra to send client errors to instead. Only the big lint/`no-explicit-any` sweep remains.

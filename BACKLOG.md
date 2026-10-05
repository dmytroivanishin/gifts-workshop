# Backlog — flat reference list

This is a **reading view**, not a second source of truth. The real record, with full
detail, history and "Done" writeups, is `CHANGE-PLAN.md` (auto-loaded into every
session via `CLAUDE.md` §14) — this file just lays out every `CP-n` in one place,
grouped by what it takes to start, so you can say "бери CP-23" and I know exactly
what that means without you having to scroll `CHANGE-PLAN.md`.

Generated 2026-10-05 from `CHANGE-PLAN.md`, `PRODUCTION-READINESS.md` and
`DEVIATIONS.md`. If these docs change later, this file can drift — ask me to
regenerate it rather than trusting it blindly after a long gap.

---

## 🔴 Waiting on you (nothing to pick here — I need an answer/action first)

- **CP-2** — upgrade `next`/`sharp`, run `npm audit fix` yourself, paste back `npm audit --omit=dev` + build output.
- **CP-4** — log in by hand and check B1–B6 in the browser; decide whether to add a mock `JWT_SECRET` to `config/test.env`.
- **CP-29** — design decision on `users.password` (nullable column, or drop it) — not a code task, your call first.

## 🟢 Ready to pick right now — pure code, no migration/config/dependency

- **CP-23** — HTTP cache headers on public GET endpoints.
- **CP-24** — seed loaders for categories/tags/colors/collections (only `system_texts` has one today).
- **CP-26** — cache `system_texts`, revalidate on admin edit.
- **CP-6** — small leftovers: `resolveStatusFilter` readability cleanup, `meta.totalItems`/`GET /collections/:id/posts` consistency.
- **CP-32** — design visual-language audit (`/portfolio-design-check`, read-only, then report what's off).
- **CP-34** — repo cleanup: stale leftover files (`public/*.svg`, old images, scratch scripts, obsolete `.agents/` doc drift) + one real small bug (`pull-system-texts.js` writes to a stale path).

## 🟡 Needs your explicit "да" first (migration / config / new dependency)

- **CP-22** — real FK constraints on `categories.parent_id`/`comments.reply_id` (migration).
- **CP-16a** — `next.config.ts`: set `experimental.proxyClientMaxBodySize` (fixes a silent upload-truncation bug).
- **CP-27** — Redis-backed rate limiter (new npm dependency).
- **CP-33** — strict, nonce-based CSP (`next.config.ts` + `proxy.ts` architecture change — wants a plan first, not just a go-ahead).
- **CP-8** — set `S3_PUBLIC_URL` for production (blocked: no domain/server yet, not actionable today).
- **CP-5** — second JWT-check layer inside controllers (deliberately deferred until after CP-2's Next upgrade).

## 🔵 Big pieces — want a scoping conversation before any code, not a quick fix

- **CP-16b** — admin media library rework (Telegram-style per-file upload queue), replacing the raw-`fetch` bypass of RTK Query.
- **CP-17** — SEO/metadata review (includes the bigger item: server-rendering post content for SEO, today fully client-fetched).
- **CP-18** — code-standard pass: ~280 lines of `any`, `withErrorHandling` wrapper, `console.*` in client components, lint cleanup (418 problems).
- **CP-19** — real `README.md` + completeness pass across the generated docs.
- **CP-25** — deployment bundle: Dockerfile, health endpoint, migration/rollback strategy, HSTS, rate-limit-at-the-edge decision, swapping dev credentials, backups (this is blocker B8).
- **CP-31** — testing infrastructure from scratch (no vitest/playwright config or specs exist at all today).
- **CP-30** — planned-but-unbuilt **features** (multi-select category filter, Archive view with restore, profile editing, SEO settings page, `Language` table) — kept separate from the fix/quality queue per your decision (2026-10-05); only start on these if you explicitly ask.

## ⚪ Parked / declined — not on the active queue

- **CP-28** — "premature refresh" token-family revocation heuristic. Presented twice (2026-09-28, 2026-10-01), declined both times. Listed only so it isn't silently forgotten.

## ✅ Done (brief — full detail and file lists are in `CHANGE-PLAN.md` → "Done")

CP-1, CP-3, CP-7, CP-9, CP-10, CP-11, CP-12, CP-13, CP-14, CP-15, CP-20, CP-21 — six rounds of small fixes (2026-09-19 through 2026-10-05) covering: anonymous-read blockers B1–B6, rate limiting, security headers, OAuth hardening (`state`+PKCE+verified ID token), dynamic sitemap, `S3_PUBLIC_URL`, media-list auth gate, dashboard `status=all`, upload MIME hardening, dead-code removal (`/users` writes), `token_sessions` purge, search escaping, `replyId`/email-allowlist checks, `adminWrite` rate limit, malformed-JSON/non-UUID handling, repository-bypass fixes, shared `issueSession()`, `next/image` on the public gallery, `parentId` existence check, `lucide-react` tree-shaking, `DrizzleDatabase` singleton on `globalThis`, search-by-description, and self-hosted fonts via `next/font`.

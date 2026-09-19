---
name: portfolio-i18n-sync
description: Keeps UI translation keys in sync: finds t('key') usages in the code, compares them with the system_texts seed, and adds missing keys (ru/en) with the right area. Use after adding or changing UI text, when a screen shows a raw key, or when asked to check or sync translations/localization.
argument-hint: "[--area admin|public|shared] [--fix-seed]"
disable-model-invocation: true
---

# Portfolio i18n Sync

UI strings are stored in the `system_texts` table (columns `code` unique, `content` JSONB `{ru, en, …}`, `area` = `admin` / `public` / `shared`) and read with `t(key)` from `useTranslation()` (`src/i18n/index.tsx`). The seed file `src/migrations/seeds/initial-data/system-texts.json` (243 rows at last count) is what a fresh database is loaded from. Entity content is localized separately, as JSONB fields, and is not covered by the seed. There is currently no single agreed flow, so this skill defines one and warns about the two stale helper scripts.

## Trigger words

translations, localization, i18n, missing key, t('...'), system texts, sync texts, add translation, перевод, локализация, не хватает ключа.

## Parameters

Arguments received: `$ARGUMENTS`

- `--area admin|public|shared` (default: all): restrict the comparison to one area.
- `--fix-seed`: write the missing keys into `system-texts.json`. Without it the skill only reports.

## Process

1. **Scan keys in code.** Use `Grep` with the pattern `(?:^|[^\w])t\(['"]([^'"]+)['"]\)` over `src/**/*.{ts,tsx}` (this is what `scratch_findKeys.mjs` does; running it with `node scratch_findKeys.mjs` is fine too, it only prints). Assign the area with the same rules the scanner uses: files under `/admin/` or `/app/api/v1/` → `admin`; files under `/(public)/` → `public`; anything in `/components/`, `app/layout.tsx`, `app/error.tsx`, `app/not-found.tsx` and other files → `shared`; a key used in more than one area becomes `shared`.
2. **Find dynamic keys** the regex cannot see: `t(\`...${x}\`)`, `t(variable)`, key tables. List them separately and check by hand that the possible values exist.
3. **Compare with the seed.** Read `system-texts.json` (`code`, `area`, `content`). Report: keys used but missing from the seed; keys in the seed that no code uses (candidates for removal, never delete automatically); rows whose `area` is narrower than actual use (for example `admin` but used on public pages, so public loading, which fetches only `public` + `shared`, would miss it); rows missing a locale from `NEXT_PUBLIC_SUPPORTED_LOCALES` (default `ru,en`).
4. **Compare with the live table only if the user supplies it.** Reading the DB needs the database running; ask the user for a dump or for permission. **Do not run `pull-system-texts.js`**: it writes to a stale path (`src/migrations/initial-data`, the real folder is `src/migrations/seeds/initial-data`) and hardcodes a dev connection string.
5. **With `--fix-seed`:** append each missing key as `{ "id": "<new uuid>", "content": { "en": "…", "ru": "…" }, "area": "<area>", "code": "<key>" }`. Keep the array's formatting (2 spaces) and existing rows untouched. Provide both languages; draft the translation from the surrounding UI text and mark every machine-drafted string in the report so the user reviews it. Never overwrite existing content.
6. **Seeding caveat.** `npx tsx src/migrations/seeds/runSystemTextsSeed.ts` inserts with `onConflictDoNothing` on `code`: it adds new keys but **does not update** existing ones. Text changes made in the JSON reach an existing database only through the admin localization editor (`/admin/localizations`, entity type `system`) or a manual SQL update. Tell the user which case applies. The seed script is not wired into `package.json`, and it loads `config/local.env` itself.
7. **Entity localization check** (report only): fields stored as JSONB `Record<locale,string>` (titles, descriptions, names) should have every active locale filled; missing locales fall back to the default locale through `utils/localization.ts`. Check the seed JSONs and the Zod `localizedStringSchema` requirements when the user asks about it.
8. **Suggest a stable flow**, no new tooling unless asked: scan → compare → `--fix-seed` → user reviews translations → run the seed (new keys) → edit existing texts in the admin editor → export the table back to the seed when the DB is the newer source.

## Output

1. **Summary:** keys in code / in seed / missing / unused / wrong area / missing locale, per area.
2. **Tables** of each group with `key | files | suggested area`.
3. **Drafted translations** to review (with `--fix-seed`), and the exact seed command to run.
4. **Caveats** that apply (seed does not update existing rows; dynamic keys).

## Example usage

```
/portfolio-i18n-sync
/portfolio-i18n-sync --area admin
/portfolio-i18n-sync --fix-seed
```

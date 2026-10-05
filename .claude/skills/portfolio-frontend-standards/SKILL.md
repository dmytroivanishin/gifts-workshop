---
name: portfolio-frontend-standards
description: Frontend rules of the Portfolio app (Next.js 16 App Router, RTK Query in src/store/api.ts, shadcn, components/{ui,shared,features}, i18n via t()/loc(), public vs admin areas, performance). Use when writing or reviewing anything under src/app pages, components, store or i18n, or when asked how the frontend should be done.
argument-hint: "[--target <path>] [--area public|admin]"
allowed-tools: Read Grep Glob
---

# Portfolio Frontend Standards

Rules for UI code. Source: `.agents/rules/frontend.md` and `.agents/rules/design.md`, corrected where the code differs (see "Where the code differs from `frontend.md`"). Visual rules are checked by `portfolio-design-check`. The Next.js in this repo is **16**: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (`middleware.ts` is now `proxy.ts`, `params` is a `Promise`).

## Trigger words

frontend standards, component rules, where does this component go, RTK Query, shadcn, client or server component, i18n key, frontend review, правила фронтенда, куда положить компонент.

## Parameters

Arguments received: `$ARGUMENTS`

- `--target <path>`: file or folder to check (default: the changed files, else `src/app`, `src/components`, `src/store`).
- `--area public|admin`: `public` = `src/app/[locale]/(public)`; `admin` = `src/app/admin`.

## Process

1. **Structure.** `components/ui` = atomic shadcn primitives (style `radix-nova`); `components/shared` = reusable composites used on several pages; `components/features` = feature-specific components. Pages, layouts and route files use the framework file names.
2. **Components.** Functional components with hooks only; one component per file; a `Props` interface for every component; proper React event types (`React.MouseEvent<HTMLButtonElement>`); no inline `style={{…}}` unless the value is dynamic and cannot be a class. Client-only code is marked `"use client"` and never imports server modules (`env.ts`, `container`, storage, repositories).
3. **Areas.** Public: highly customized UI, shadcn only for core inputs (search, buttons, badges, popover, icons). Admin: heavy shadcn, standard forms/tables for efficiency. One shared color scheme for both.
4. **Server state = RTK Query.** Every endpoint lives in `src/store/api.ts` (add the route's endpoint there, with `providesTags` / `invalidatesTags` and the matching entry in `tagTypes`). Do not `fetch` API routes directly from components. Local slices in `src/store/slices` only for UI state (for example notifications). Silent refresh on 401 is handled by `baseQueryWithReauth`; do not reimplement it.
5. **Forms.** react-hook-form + zod 4; validation schema next to the form or shared with `common/validation/schemas.ts`; errors shown with the shared components; toasts through the notification slice/`sonner` (`GlobalToaster`).
6. **i18n.** No hardcoded UI strings. UI text: `const { t } = useTranslation()` from `@/i18n`, key stored in the `system_texts` table (area `public` / `admin` / `shared`); new keys go through `portfolio-i18n-sync`. Entity fields are JSONB `{locale: text}`: read them with `loc(field)` or `getLocalizedField` from `utils/localization.ts`. Public locale comes from the URL (`/ru`, `/en`), admin locale from the `admin_locale` cookie.
7. **Performance.** `next/image` for images (raw `<img>` exists in 6 places — admin lists, drag-and-drop/crop widgets; the public project gallery switched to `next/image` 2026-10-02, second round — do not add more raw `<img>`; set width/height to prevent layout shift; a remote image host needs an entry in `next.config.ts`'s `images.remotePatterns`); `next/font` for fonts (Inter/Playfair Display load via `next/font/google` since 2026-10-05, `src/app/layout.tsx`; do not go back to a CSS `@import`); import icons by name from `lucide-react`, never `import * as` (the one remaining offender, the public project gallery, was fixed 2026-10-05); `useMemo` / `useCallback` for heavy trees or store transforms only; avoid setting state synchronously inside `useEffect` (19 lint errors already, see `react-hooks/set-state-in-effect`).
8. **No dark mode.** Do not add `dark:` variants or `next-themes` outside shadcn primitives.
9. **SEO.** Metadata and hreflang for public pages via `generateMetadata`; sitemap/robots are route files under `src/app`. Public pages are client-rendered today; server-fetching the first page is the recommended direction, not a requirement for every change.

### Where the code differs from `frontend.md`

- Exports: the rule says default export, one component per file; the code mostly uses named exports for shared/feature components. Follow the neighbor files of the same folder and do not churn existing files; pages/layouts must keep default exports (framework requirement).
- RTK Query: the rule says `src/services/` or `src/features/`; the code keeps everything in `src/store/api.ts` (442 lines).
- Typed hooks: the rule says `useAppDispatch` / `useAppSelector`; the code calls plain `useDispatch` / `useSelector` (no typed hooks exist yet). Prefer creating typed hooks in `src/store/index.ts` over adding more untyped calls.
- Tailwind config: the rule mentions `tailwind.config.js`; the project uses Tailwind 4 with CSS tokens in `src/app/globals.css` (`@theme inline`).

## Output

Writing mode: the component/code plus notes on the decisions (client vs server, which endpoint/tag, new `t()` keys). Review mode: a list `file:line | rule | fix` split into *new* and *known debt* (`DEVIATIONS.md` → Frontend). No files are modified by this skill itself.

## Example usage

```
/portfolio-frontend-standards
/portfolio-frontend-standards --target src/app/admin/tags --area admin
/portfolio-frontend-standards --target src/components/features/ProjectCard.tsx
```

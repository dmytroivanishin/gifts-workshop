---
name: portfolio-design-check
description: Checks UI code against the Portfolio visual language (palette tokens, glassmorphism, soft shadows, hover/motion values, typography, 12px cards and pill controls, empty states, no dark mode). Use when building or changing UI, before merging frontend changes, or when asked whether something matches the design.
argument-hint: "[--target <path>] [--area public|admin]"
allowed-tools: Read Grep Glob
---

# Portfolio Design Check

Read-only visual-language audit. Sources: `.agents/rules/design.md` (the rules), `.agents/project-plan/colors.md` (palette: Ivory, Brown, Orange, Tan, … scales 50–950), `.agents/project-plan/theme_design.md` (shadcn CSS variables), `src/app/globals.css` (the implemented tokens), `.agents/project-plan/design.jpg` and `.agents/project-plan/example-ui/` (reference images). The `theme_colors.md` that `design.md` and the old review workflow mention does not exist; use the files above. Split out from step 2 of `portfolio-code-review`.

## Trigger words

design check, does it match the design, UI review, visual consistency, hover, animation, tokens, colors, typography, glassmorphism, проверь дизайн, соответствует ли дизайну, стили.

## Parameters

Arguments received: `$ARGUMENTS`

- `--target <path>`: file or folder (default: the changed files, else `src/app` and `src/components`).
- `--area public|admin`: the public site (`src/app/[locale]/(public)`) is highly customized with minimal shadcn; the admin (`src/app/admin`, `.admin-area` theme) uses shadcn heavily. Both share one color scheme.

## Process

1. **Load the tokens.** Read `globals.css` (`@theme inline`, `:root`, `--radius: 0.75rem`, `--font-sans` Inter, `--font-heading` Playfair Display, category pastel pairs, `.admin-area`) so findings refer to real token names.
2. **Palette.** Colors come from tokens or palette utilities, not arbitrary hex/rgb literals. Grep `#[0-9a-fA-F]{3,8}` and `rgb(`/`hsl(` in `className`/`style`; the only accepted literals are shadow definitions and values that come from data (category colors stored in the DB).
3. **Depth and surfaces.**
   - Glassmorphism for overlays, navbars and cards: translucent background with `backdrop-blur` (used in 8 files today).
   - Large areas use subtle gradients from the palette, not flat fills.
   - Shadows are very soft and layered, for example `0 12px 30px rgba(0,0,0,0.08)`.
4. **Interactions and motion.** Every interactive element has a refined state:
   - cards: `translateY(-6px)` on hover, `0.4s ease`;
   - images inside cards: `scale(1.03)`, `0.6s ease`;
   - like icon: `scale(1.1–1.15)` with `cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
   - buttons and links: transition `0.2–0.3s ease`;
   - page transitions: Framer Motion fade-in + slide-up.
   These exact values were **not** audited before (`DEVIATIONS.md` says so): report `matches` / `differs (found value)` / `not found`.
5. **Typography.** Playfair Display for headings, Inter for UI/body; headings `line-height: 1.2`, weight 500–600; body `line-height: 1.5`, size 0.9–1rem; tags/meta: `letter-spacing: 0.06em`, uppercase, weight 700. Fonts should come from `next/font` (today they come from a CSS `@import` on Google Fonts; do not add more).
6. **Shape.** Cards/containers 12px radius (`rounded-xl` / `--radius`); controls, search bars, category tags full pill (`rounded-full`, 100px).
7. **States.** No blank screens: skeletons or elegant placeholders for loading and empty lists; error states use the shared components.
8. **No dark mode.** No `dark:` variants and no `next-themes` outside shadcn primitives (`sonner.tsx` uses `next-themes` today); hierarchy comes from white space, shadows and blur.
9. **Consistency and craft.** No inline styles except dynamic values; icons from `lucide-react` by name; images via `next/image` with dimensions; spacing follows the existing scale; the component matches the reference image where one exists (`design.jpg`, `example-ui/`). Public area: shadcn limited to core inputs, buttons, badges, popover, icons. Admin: standard shadcn patterns.
10. **Accessibility basics that design rules imply:** sufficient contrast on tinted/glass surfaces, visible focus rings, hover-only affordances also reachable by keyboard.

## Output

1. **Verdict per file:** `consistent` / `minor drift` / `off-design`.
2. **Findings table:** `file:line | rule (from design.md) | found | expected | fix` (with a Tailwind/CSS snippet).
3. **Values not verifiable from code** (for example real contrast, rendering); suggest a manual look in the browser and name the screens.

No files are modified.

## Example usage

```
/portfolio-design-check
/portfolio-design-check --target src/components/features/ProjectCard.tsx --area public
/portfolio-design-check --area admin
```

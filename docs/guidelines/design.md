> Moved from `.agents/rules/design.md` (2026-10-06, CP-34). This is the project's active visual-language spec — checked by `/gift-workshop-design-check` — not superseded by `CLAUDE.md` the way the other retired `.agents/rules/*` files were.

## Visual Language
- **Color Palette**: Strictly follow colors defined in `docs/project-plan/colors.md` (`theme_design.md` for the shadcn CSS variables). Use these tokens consistently across all components.
- **Glassmorphism**: Use translucent backgrounds with `backdrop-blur` for overlays, navbars, and cards.
- **Gradients**: Avoid flat colors for large areas. Use subtle gradients with curated colors from the palette.
- **Shadows**: Use very soft, layered shadows for depth, e.g., `0 12px 30px rgba(0, 0, 0, 0.08)`.

## Interactions & Motion
- **Micro-interactions**: Every interactive element MUST have a refined state:
  - **Cards**: `translateY(-6px)` on hover with **0.4s ease**.
  - **Images**: `scale(1.03)` inside cards on hover with **0.6s ease**.
  - **Icons (Like)**: `scale(1.1 - 1.15)` with `cubic-bezier(0.175, 0.885, 0.32, 1.275)` for a springy feel.
  - **Buttons/Links**: Simple transition **0.2s - 0.3s ease**.
- **Page Transitions**: Implement smooth entry animations using Framer Motion (Fade in + Slide up).

## Typography
- **Fonts**: Use 'Playfair Display' for serif headings and 'Inter' for sans-serif UI/body text.
- **Hierarchy**:
  - **Headings**: `line-height: 1.2`, `font-weight: 500-600`.
  - **Body Text**: `line-height: 1.5`, `font-size: 0.9rem - 1rem`.
  - **Tags/Meta**: `letter-spacing: 0.06em`, uppercase, `font-weight: 700`.

## Attention to Detail
- **Rounded Corners**:
  - **Containers/Cards**: **12px** border-radius for a balanced modern look.
  - **Controls/Tags**: **100px** (Full pill) for buttons, search bars, and category tags.
- **Empty States**: Never show a blank screen. Use skeletons or elegant placeholders.
- **Theme Focus**: NO Dark Mode. Use white-space, shadows, and blurs to define hierarchy.


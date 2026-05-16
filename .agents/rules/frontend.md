---
trigger: always_on
---

# Frontend Architecture Rules

## Technology Stack
- **Framework**: Next.js (App Router)
- **Library**: React
- **State Management**: Redux Toolkit + RTK Query
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/UI (Radix UI)
- **Icons**: Lucide React (or similar)

## Component Structure
  - `components/ui`: Atomic components (buttons, inputs, cards) - primarily Shadcn/UI.
  - `components/shared`: Reusable complex components used across multiple pages.
  - `components/features`: Business-logic specific components organized by feature.
- **Functional Components**: Use only functional components with Hooks.
- **Component Definitions**: One component per file. Export as default.

## Multi-Area Architecture
- **Single Theme**: The application uses one global color scheme derived from `theme_colors.md` for both Public and Admin areas.
- **Public Area**: High-customized UI. Minimal Shadcn usage (only for core inputs like Search, Buttons, Badges, Poppover, Icons). Focus on custom components and unique layouts.
- **Admin Area**: Heavy Shadcn usage. Standardized UI components for data management and efficiency.
- **Strict Interfaces**: Every component must have a `props` interface defined.
- **Event Handling**: Use proper React event types (e.g., `React.MouseEvent<HTMLButtonElement>`).
- **No Inline Styles**: Use Tailwind classes or CSS Modules. No `style={{...}}` unless for dynamic values that cannot be pre-calculated.

## State Management (Redux Toolkit)
- **Store Structure**: Slice-based organization. Keep logic in reducers/extraReducers.
- **Data Fetching**: Use **RTK Query** for all server state. Define services in `src/services/` or `src/features/`.
- **Hooks**: Use typed hooks (`useAppDispatch`, `useAppSelector`) instead of plain Redux hooks.

## UI & Components (Shadcn/UI)
- **Customization**: Extend Shadcn components via `tailwind.config.js` and CSS variables.
- **Radix UI**: Leverage Radix primitives for accessibility when building custom components outside Shadcn.

## Performance
- **Next.js Optimization**: Use `next/image` for all images. Use `next/font` for typography.
- **Memoization**: Standard use of `useMemo`/`useCallback` for heavy component trees or complex data transformations from the Redux store.

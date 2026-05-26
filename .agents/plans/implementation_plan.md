# Portfolio Foundation Implementation Plan

This plan details the steps to implement the foundational architecture of the Portfolio project based on `.agents/project-plan/` and `.agents/rules/`.

## User Review Required
Please review the proposed architecture and tech stack choices. Once approved, I will proceed with creating the folder structure and implementing this foundation.

## Open Questions
- We will use `npm` as the package manager since we are initializing via `create-next-app`. Is this acceptable, or do you prefer `yarn` / `pnpm`?
- For the backend Database ORM, should we assume Prisma with PostgreSQL for this foundational step (since we need to define types)? For now, I will create plain TypeScript interfaces.

## Proposed Changes

### Step 1: Project Initialization & Core Structure
We will initialize a Next.js (App Router) project in the root directory.
- Run `npx -y create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
- Install additional dependencies: `npm install @reduxjs/toolkit react-redux lucide-react framer-motion clsx tailwind-merge`
- Initialize shadcn/ui: `npx -y shadcn-ui@latest init -y`

### Step 2: Foundation (Tailwind & CSS Variables)
Based on `theme_design.md` and `design.md`.
#### [MODIFY] src/app/globals.css
- Inject the Light Theme and Admin Area CSS variables (Tan, Rose, Lime, etc.).
- Add font imports for 'Playfair Display' and 'Inter'.
- Set base styles and typography hierarchy.

#### [MODIFY] tailwind.config.ts
- Configure Shadcn UI colors and border radii (12px for cards, 100px for pills).
- Add custom color extensions for category accents (e.g., `rose-bg`, `lime-text`).

### Step 3: Base Layout (Public & Admin Zones)
Implement the Multi-Area Architecture.
#### [NEW] src/app/(public)/layout.tsx
- Basic layout for the public facing site (with glassmorphism headers, etc.).
#### [NEW] src/app/(admin)/layout.tsx
- Basic layout for the admin area (sidebar with `--secondary` background).
#### [MODIFY] src/app/layout.tsx
- Setup root layout, integrate Redux Provider, and apply global fonts.

### Step 4: Redux Store & RTK Query Configuration
#### [NEW] src/store/index.ts
- Configure the Redux Toolkit store.
#### [NEW] src/store/api.ts
- Setup the base RTK Query service pointing to `/api/v1`.
#### [NEW] src/store/Provider.tsx
- Client-side wrapper for providing the Redux store.

### Step 5: TypeScript Interfaces
#### [NEW] src/types/index.ts
- Define strict TS interfaces for `User`, `Collection`, `Category`, `Tag`, `Media`, `Post` (Project).
- Ensure no `any` types are used, applying `readonly` where appropriate.

### Step 6: Reference Component & API Endpoint
Showcasing the code standard for the Builder (Flash) model.
#### [NEW] src/components/features/ProjectCard.tsx
- Implement a visually stunning `ProjectCard` with Framer Motion hover effects (`translateY(-6px)`, `scale(1.03)`).
- Include Image gallery, Title, Category Badges, and interactive Like button.
#### [NEW] src/app/api/v1/collections/[slug]/posts/route.ts
- Implement a reference RESTful GET endpoint following the Backend architectural rules (Controller logic, standardized error handling response contract).

## Verification Plan
### Automated Tests
- Run `npm run build` to ensure TypeScript compilation and Next.js build succeeds without errors.
- Run `npm run lint` to verify adherence to ESLint rules.

### Manual Verification
- Start the dev server `npm run dev` and verify that the base layouts for `/` (public) and `/admin` (admin) render correctly with the applied fonts and themes.
- Test the reference API endpoint in the browser or via `curl`.

# Layered Architecture, i18n, Auth, and UI Polish Plan

This plan addresses all architectural feedback, implements localization, Google Auth, custom color picked categories, interactive image cropping, and polishes the public UI design to meet strict high-end design principles.

## Proposed Changes

### Step 1: Layered Backend Architecture (Repositories, Services, Controllers)
We will refactor our Next.js API routes to decouple HTTP handling, business logic, and database operations:
- **Repository (`src/repositories/`)**:
  - `PostRepository`: CRUD for posts in `db.json`.
  - `CategoryRepository`: CRUD for categories in `db.json`.
- **Service (`src/services/`)**:
  - `PostService`: Handles search logic, status filters, localization formatting, and validation.
  - `CategoryService`: Coordinates category ordering and accent color logic.
- **Controller (`src/controllers/`)**:
  - `PostController`: Resolves incoming requests, validates body formats, and structures JSON responses.
  - `CategoryController`: Orchestrates HTTP actions for categories.
- **Route Handlers (`src/app/api/`)**: Instantiates controllers and delegates request execution.

### Step 2: i18n Localization System
- Create `src/i18n/` with `ru.json` and `en.json` translation files.
- Establish a global React i18n Context/hook (`useTranslation`) to toggle UI languages.
- Update `src/data/db.json` to store multi-language strings for `title` and `description` (e.g. `{ "ru": "Зайка...", "en": "Dreamy Bunny..." }`) and render based on active language.

### Step 3: Google Login & Route Protection
- Create `/admin/login/page.tsx` featuring a premium Google Sign-In interface.
- Add an authentication middleware/checker in `src/app/admin/layout.tsx` that redirects unauthorized users to `/admin/login`.
- Handle Google authentication state via Redux/LocalStorage.

### Step 4: Custom Hex Color Picker for Categories
- Refactor `src/app/admin/categories/page.tsx` to replace dropdown color choices with an HSL/Hex **Color Picker** (`input type="color"`).
- Render category badges on cards and detail pages dynamically using their database HEX color values with an inline background opacity shift (`bg-[#hex]33` or HSL styles).

### Step 5: Interactive Image Cropper (Drag/Resize Canvas)
- Implement `src/components/shared/ImageCropModal.tsx` that presents a workspace where users can drag, zoom, and crop image elements to set the thumbnail dimensions.
- Save the exact `Position` coordinates `{ x, y, width, height }` inside `media[].position` in `db.json`.

### Step 6: Public UI Polish
- **Branding**: Completely remove the top "Portfolio" header strip.
- **Flat Card Style**: Remove backgrounds, borders, and shadows from project cards (giving a clean flat look).
- **Categories Row**: Render categories as clean text labels using standard weight fonts.
- **Like Icon**: Rose color borders.
- **Typography**: Force Playfair Display on card titles, Inter on description, and `#AFAA9E` on "Смотреть работу" links.
- **Route Syncing**: Sync category selection with the browser URL (`/?category=...`) via Next.js `useSearchParams`.

## Verification Plan
- Run `npx tsc --noEmit` to verify type checks.
- Verify multi-language translation toggles, hex color pickers, and flat UI styling.

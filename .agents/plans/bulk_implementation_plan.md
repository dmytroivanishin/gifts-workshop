# Bulk Features Implementation Plan

This plan details the steps to implement the rest of the Portfolio application (both Public Area and Admin Panel) using the pre-established foundation.

## Proposed Changes

### Step 1: Mock Data & State Management Configuration
To make the application interactive and allow testing without a live database (or during the initial frontend setup), we will configure RTK Query with local mock states or implement a robust mock client.
- Create `/src/mocks/projects.ts` containing the beautiful items shown in `example-ui/index.html` (Зайка Мечтательница, Осенний Жираф, etc.), linking them to `/images/image-1.png`, etc.
- Add mock handlers to the RTK Query `src/store/api.ts` service so that `/api/v1/collections/all/posts` returns this rich list of projects.

### Step 2: Public Main Page (`src/app/(public)/page.tsx`)
We will create a premium Pinterest-style home page.
- **Header logo**: Render `/images/logo.png` centered at the top.
- **Search bar**: A fully pill-rounded search bar with state tracking.
- **Category Filter Bar**: A beautiful row of category pills (Все, Плюшевые истории, Куколки, В наличии, etc.) styled with the specific pastel bg/text classes (e.g. `bg-rose-bg text-rose-text` for Плюшевые истории).
- **Masonry Grid**: Display projects in a CSS `column-count` masonry grid.
- **Like persistence**: Connect the `ProjectCard` like button to `localStorage` state, and add a quick-toggle "Favorites" heart button in the filter bar to show only liked projects.
- **Infinite scroll**: Add a scroll-listener or loading state button to load more mock projects.

### Step 3: Public Project Detail Page (`src/app/(public)/projects/[slug]/page.tsx`)
Implement the project detail page.
- **Hero Image Grid**: Masonry grid of the project's images (Pinterest-style).
- **Project Meta**: Large Playfair Display title, Category & Tag badges.
- **Contact Panel**: Direct inquiry buttons for Telegram, WhatsApp, and Email.
- **Navigation**: Support clicking category badges to redirect back home with active filters.

### Step 4: Admin Panel Dashboard & Navigation (`src/app/(admin)/dashboard/page.tsx`)
Build the control panel.
- Create list view for all posts/projects.
- Add "Create Post" button.
- Support filtering and searching within the lists.

### Step 5: Admin Category Management CRUD (`src/app/(admin)/categories/page.tsx`)
- Standard CRUD table using Shadcn components for Categories.
- Assign colors using a color picker from the pre-defined pastel palette variables.

### Step 6: Admin Media Library (`src/app/(admin)/media/page.tsx`)
- Grid displaying all uploaded assets.
- Drag-and-drop file upload.
- Square cropping utility stub.

## Verification Plan
### Automated Tests
- Run `npm run lint` and `npm run build` to verify the complete TypeScript compilation.

### Manual Verification
- Start the server `npm run dev`.
- Visual check on `/` to verify it matches `example-ui/index.html` aesthetics perfectly (tan background, custom cards with arrows and dots, HSL colors).
- Test filtering by "Toys", "In Stock", and "Favorites".
- Open `/projects/sample-bunny` and verify details page looks premium.
- Open `/admin/dashboard` to verify sidebar navigation and table rendering.

# Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI components
    - https://ui.shadcn.com/
- Redux Toolkit
- RTK Query
- E2E tests - Playwright
- Component tests - Vitest
- Unit tests - Vitest
- Coverage tests - Vitest
- Linting - ESLint
- Prettier


## Public Site
Shadcn UI components needs to use partially because a lot of custom styles and structure is required like custom cards for home page. ONLY search input, category items, popover, tooltip for like button.

- **Home Page**:
    - Header featuring the logo and a real-time search bar.
    - Category Filter bar (using colored badges).
    - Language Switcher (Locale selection).
    - Masonry grid layout for project cards with infinite scroll pagination.

- **Card Component**:
    - Image carousel/gallery with navigation arrows and position dots.
    - Title and Description (truncated to 100 characters).
    - Dynamic Category Badge (colors defined in Admin).
    - "In Stock" / "Made to Order" badge based on status.
    - Interactive Like button with device-local persistence.

- **Project Detail Page**:
    - Pinterest-style image grid for project photos.
    - Comprehensive description, category, and tags.
    - Contact/Inquiry Buttons (Telegram, WhatsApp, Email).
    - Navigation logic: Clicking category/tags redirects to Home with active filters.

 

## Admin Panel
Shadcn UI components must be used everywhere in admin panel
- **Auth**: Secure login limited to the site owner (single admin).
- **Post/Project Editor**:
    - Create/Edit/Archive projects.
    - Status management (Draft vs. Published).
    - Image management: Bulk upload, square cropping tool for thumbnails, and drag-and-drop reordering.
    - Field management: Title, Description, Category (implicit creation), Tags (combobox).
    - Date override to manually sort/prioritize posts.
- **Category & Tag Management**:
    - CRUD operations for categories with color palette selection.
    - CRUD for tags (linked to categories).
    - Search and filter within management lists.
- **Media Library**:
    - Centralized library for all uploaded assets.
    - Safe deletion (verification that image isn't used in any post/cover).
- **Archive**:
    - Separate view for deleted posts with restore functionality.
- **Localization Management**:
    - CRUD for localized strings and content.
- **SEO Settings**:
    - Interface to manage slugs and metadata for pages and projects.
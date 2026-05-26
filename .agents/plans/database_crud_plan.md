# Local DB & Admin Project Creation Plan

This plan introduces real local file-based database persistence and the Admin creation/editing form, making the application fully interactive.

## Proposed Changes

### Step 1: File-Based Local Database (`src/data/db.json` & `src/lib/db.ts`)
We will create a simple JSON file database that persists changes to `src/data/db.json`.
- `src/data/db.json`: Holds initial categories and mock posts.
- `src/lib/db.ts`: Provides helper functions to read and write database state:
  - `getDb()`: Reads and parses JSON.
  - `saveDb()`: Writes to JSON.
  - CRUD operations for Posts, Categories, and Media.

### Step 2: Next.js API Route Handlers
We will replace our mock `queryFn` layers with actual Next.js 15 route handlers:
- `src/app/api/v1/posts/route.ts` (GET: returns filtered posts, POST: saves new post).
- `src/app/api/v1/posts/[id]/route.ts` (GET: single post, PUT: update post, DELETE: delete post).
- `src/app/api/v1/categories/route.ts` (GET: categories, POST: create/update category).

### Step 3: Connect RTK Query to Real API routes
- Update `src/store/api.ts` to remove the local `queryFn` override and use `query` directly to call the Next.js API routes `/api/v1/posts`, `/api/v1/categories`, etc.
- Add `createPost`, `updatePost`, and `deletePost` mutations to the store.

### Step 4: Admin Form for Creating/Editing Projects (`src/app/admin/projects/new/page.tsx`)
Create a highly visual, clean admin project form.
- Form fields: Title, Description, Category dropdown, "In Stock" toggler.
- Cover/Media Selection: Select images from the Media Library.
- Status: Draft, Published, Archived.
- Redirect back to `/admin/dashboard` upon successful creation.

## Verification Plan
- Run `npx tsc --noEmit` to verify type safety.
- Manually create a project in the Admin Panel and verify it persists upon browser refresh and is visible in the Public Grid.

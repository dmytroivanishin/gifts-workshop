# Backend Project Plan

## Stack
- **Runtime**: Node.js
- **Framework**: Express.js (or NestJS)
- **Database**: NoSQL Document-based (e.g. MongoDB, DocumentDB) or PostgreSQL (Schema in diagram looks relational, but can be implemented in MongoDB).
- **Auth**: Google OAuth 2.0 + JWT (Diagram shows standard Sign-in/Sign-out and User table).
- **Image Processing**: Sharp (for conversion and resizing).
- **API Versioning**: Prefix all routes with `/api/v1`.

## Public API

- **GET /api/v1/albums/:slug/posts**: 
    - Retrieve posts belonging to a specific album.
    - **Query Params**:
        - `search`: filter by title/description.
        - `category`: array of category slugs.
        - `tag`: array of tag slugs.
        - `in_stock`: boolean filter.
        - `page`: for pagination.
- **GET /api/v1/albums/:slug/posts/:post_slug**: 
    - Retrieve full project details, including all image metadata, positions, and taxonomy.
- **GET /api/v1/categories**: 
    - List all active categories with their color metadata.
- **GET /api/v1/tags**: 
    - List all tags, optionally filtered by category.
- **GET /api/v1/localization/:locale**:
    - Fetch localized strings/content.

## Admin API

- **Auth**:
    - `POST /api/v1/admin/sign-in`
    - `POST /api/v1/admin/sign-out`
- **User Management**:
    - CRUD for users (`/api/v1/admin/users`).
- **Album Management**:
    - CRUD for albums (`/api/v1/admin/albums`).
- **Post Editor**:
    - CRUD for posts (`/api/v1/admin/posts`).
    - Soft-delete (Archive) and Restore logic.
    - Status management (Draft vs. Published).
    - Date override for manual sorting.
    - `in_stock` status toggle.
- **Taxonomy Management**:
    - CRUD for categories (`/api/v1/admin/categories`).
    - CRUD for tags (`/api/v1/admin/tags`).
    - Logic for implicit category creation if it doesn't exist during post creation.
- **Color Management**:
    - CRUD for colors (`/api/v1/admin/colors`).
- **Media Management**:
    - Bulk upload handling (`/api/v1/admin/media`).
    - Convert all images to JPG.
    - Generate two sizes:
        - **Thumbnail**: 300x300 (fit).
        - **Original**: 1200x1200 (fit).
    - Integrity check: Prevent deletion of media if used in any post or as a cover.
- **Localization**:
    - CRUD for localized content (`/api/v1/admin/localization`).
- **Slug Management**:
    - Manage entity slugs (`/api/v1/admin/slugs`).

## Data Models

- **User**:
    - `id`, `email`, `name`, `password`.
- **Album**:
    - `id`, `title`, `description`, `slug`.
- **Category**:
    - `id`, `title`, `description`, `colorId` (ref Color), `albumId` (ref Album), `userId`.
- **Tag**:
    - `id`, `name`, `categories` (Array of IDs), `userId`.
- **Color**:
    - `id`, `color` (hex/string), `userId`.
- **Media**:
    - `id`, `originalUrl`, `thumbnailUrl`, `userId`.
- **Post**:
    - `id`, `title`, `description`, `posterId` (ref Media), `in_stock` (Boolean), `status` (Draft/Published/Archived), `userId`, `categoryId`, `tags` (Array of IDs).
    - `media` (Array of PostMedia objects).
- **PostMedia**:
    - `id`, `order`, `mediaId`, `position` (Object: {x, y, width, height}).
- **Localization**:
    - `id`, `locale`, `payload` (JSON), `entity` (String), `userId`.
- **Slug**:
    - `id`, `name`, `entity` (String/ID).

---

**Important (Consistency when deleting):**
If an admin deletes a Tag or Category from their own collections, you'll need to run a background task that will remove that ID from the tags and categories arrays in all posts. NoSQL doesn't have a built-in ON DELETE CASCADE.

### REST API Response contract:

**List response**
```json
{
  "data": [{}],
  "meta": {
    "page": 1,
    "nextPage": "",
    "prevPage": "",
    "totalItems": 0
  }
}
```
**Item response**
```json
{
  "data": {}
}
```
**Error response**
```json
{
  "error": {
    "message": "",
    "code": "",
    "details": [{
      "field": "",
      "message": ""
    }]
  }
}
```

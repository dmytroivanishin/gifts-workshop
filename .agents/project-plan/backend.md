# Backend Project Plan

## Stack
- **Runtime**: Node.js
- **Framework**: Express.js (or NestJS)
- **Database**: NoSQL Document-based (e.g. MongoDB, DocumentDB) or PostgreSQL (Schema in diagram looks relational, but can be implemented in MongoDB).
- **Auth**: Google OAuth 2.0 + JWT (Diagram shows standard Sign-in/Sign-out and User table).
- **Image Processing**: Sharp (for conversion and resizing).
- **API Versioning**: Prefix all routes with `/api/v1`.

## Public API

- **General**:
    - `GET /api/v1/albums/:slug/posts`: Retrieve posts belonging to a specific album.
    - `GET /api/v1/albums/:album_slug/posts/:post_slug`: Retrieve full project details.
- **Filter posts by query**:
    - `?category=...&category=...`: Filter by multiple category slugs.
    - `?tag=...&tag=...`: Filter by multiple tag slugs.
    - `?in_stock=true`: Filter by availability.
- **Pagination**:
    - `?page=1`: Standard pagination.

## Admin API

- **Auth**:
    - `POST /api/v1/admin/auth/sign-in`
    - `POST /api/v1/admin/auth/sign-out`
- **User Management**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/users`
- **Album Management**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/albums`
- **Category Management**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/categories`
- **Tag Management**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/tags`
- **Media Management**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/media`
    - Convert all images to JPG.
    - Generate sizes: **Thumbnail** (300x300) and **Original** (1200x1200).
- **Localization**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/localization`
- **Post Editor**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/posts`
    - Status management (Draft vs. Published vs. Archived).
- **Color Management**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/colors`
- **Slug Management**:
    - `GET, POST, PATCH, DELETE /api/v1/admin/slugs`

## Data Models

- **User**:
    - `id`, `email`, `name`, `password`.
- **Album**:
    - `id`, `title`, `description`.
- **Category**:
    - `id`, `title`, `description`, `color` (ref Color), `album` (ref Album), `user` (ref User).
- **Color**:
    - `id`, `color` (hex/string), `user` (ref User).
- **Media**:
    - `id`, `thumbnailUrl`, `originalUrl`, `user` (ref User).
- **Slug**:
    - `id`, `name`, `entity` (String/ID), `user` (ref User).
- **Localization**:
    - `id`, `locale`, `payload` (JSON), `entity` (String/ID), `user` (ref User).
- **Tag**:
    - `id`, `name`, `user` (ref User), `categories` (Array of IDs).
- **Post**:
    - `id`, `title`, `description`, `media` (Array of PostMedia), `poster` (ref Media), `in_stock` (Boolean), `status`, `user` (ref User), `category` (ref Category), `tags` (Array of IDs).
- **PostMedia**:
    - `id`, `order`, `media` (ref Media), `position` (ref Position).
- **Position**:
    - `id`, `x`, `y`, `width`, `height`.

---

**Important (Consistency when deleting):**
If an admin deletes a Tag or Category, run a background task to remove that ID from all associated posts. NoSQL lacks built-in ON DELETE CASCADE.

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

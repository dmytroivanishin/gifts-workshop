# Backend Project Plan

## Stack & Architecture
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (relational DB as shown in the diagram schema with foreign keys) or NoSQL Document-based (e.g. MongoDB, where relations are handled via referencing).
- **ORM**: Prisma, TypeORM, or custom (to be decided based on DB selection).
- **Image Processing**: Sharp (for conversion, resizing, and optimizations).
- **API Versioning**: Prefix all routes with `/api/v1`.

### Layered Structure
- **Controllers**: Handle HTTP requests only. Extract parameters, validate input, and delegate to services. No business logic.
- **Services**: All business logic, calculations, and domain rules are encapsulated here.
- **Repositories**: Database access abstraction. Use interfaces to ensure the database engine can be swapped seamlessly (e.g., swapping PostgreSQL with MongoDB) without altering service logic.
- **Storage Strategy**: **Adapter/Strategy Pattern** for file/media uploads. Define a generic storage interface so the backend can easily switch between Local Storage, AWS S3, or Cloudinary.

### Routing & Naming
- Use RESTful naming conventions.
- Route paths must use `kebab-case`.
- Prefix all routes with `/api/v1`.

## Authentication & Security
- **Strategy**: Google OAuth 2.0 + JWT.
- **Token Management**:
  - **Access Tokens**: Short-lived, passed in headers.
  - **Refresh Tokens**: Long-lived, stored securely in **HttpOnly, Secure, SameSite=Strict cookies** to prevent XSS/CSRF.
  - **Silent Refresh**: Endpoint `/api/v1/admin/auth/refresh` (or integrated mechanism) to renew access tokens automatically.
- **Single-Admin Mode**:
  - No public registration or sign-up endpoints.
  - Access is restricted to a single hardcoded administrator Google email address.
  - A dedicated `authMiddleware` verifies the JWT access token and ensures the user's email matches the allowed admin email.

---

## Public API

- **General**:
    - `GET /api/v1/collections/:slug/posts`: Retrieve posts belonging to a specific collection.
    - `GET /api/v1/collections/:collection_slug/posts/:post_slug`: Retrieve full project details.
- **Filter posts by query**:
    - `?search=<title / description>`: Text search filter matching title or description of posts.
    - `?category=...&category=...`: Filter by multiple category slugs.
    - `?tag=...&tag=...`: Filter by multiple tag slugs.
    - `?in_stock`: Filter by availability.
- **Pagination**:
    - `?page=1`: Standard pagination.

## Admin API

- **Auth**:
    - `POST /api/v1/admin/auth/sign-in`
    - `POST /api/v1/admin/auth/sign-out`
    - `POST /api/v1/admin/auth/refresh` (Token refresh)
- **User Management**:
    - `GET /api/v1/admin/users`
    - `POST /api/v1/admin/users`
    - `PATCH /api/v1/admin/users/:userId`
    - `DELETE /api/v1/admin/users/:userId`
- **Collection Management**:
    - `GET /api/v1/admin/collections`
    - `POST /api/v1/admin/collections`
    - `PATCH /api/v1/admin/collections/:collectionId`
    - `DELETE /api/v1/admin/collections/:collectionId`
- **Category Management**:
    - `GET /api/v1/admin/categories`
    - `POST /api/v1/admin/categories`
    - `PATCH /api/v1/admin/categories/:categoryId`
    - `DELETE /api/v1/admin/categories/:categoryId`
- **Tag Management**:
    - `GET /api/v1/admin/tags`
    - `POST /api/v1/admin/tags`
    - `PATCH /api/v1/admin/tags/:tagId`
    - `DELETE /api/v1/admin/tags/:tagId`
- **Media Management**:
    - `GET /api/v1/admin/media`
    - `POST /api/v1/admin/media`
    - `PATCH /api/v1/admin/media/:mediaId`
    - `DELETE /api/v1/admin/media/:mediaId`
    - Convert all images to JPG.
    - Generate sizes: **Thumbnail** (300x300) and **Original** (1200x1200).
- **Post Editor**:
    - `GET /api/v1/admin/posts`
    - `POST /api/v1/admin/posts`
    - `PATCH /api/v1/admin/posts/:postId`
    - `DELETE /api/v1/admin/posts/:postId`
    - Status management (Draft vs. Published vs. Archived).
- **Color Management**:
    - `GET /api/v1/admin/colors`
    - `POST /api/v1/admin/colors`
    - `PATCH /api/v1/admin/colors/:colorId`
    - `DELETE /api/v1/admin/colors/:colorId`

---

## Data Models

- **User**:
    - `id`, `email`, `name`, `password`.
- **TokenSession**:
    - `id` (String / UUID - Primary Key, maps to JTI), `userId` (ref User, onDelete: cascade), `refreshTokenHash` (String), `isUsed` (Boolean), `expiresAt` (Number - Unix timestamp), `tokenFamily` (String).
- **Language**:
    - `id` (String - e.g., 'en', 'ru'), `name` (String), `isActive` (Boolean).
- **SystemText**:
    - `id` (String - translation key), `content` (localized object `Record<string, string>`).
- **Collection**:
    - `id`, `slug` (String), `title` (localized object `Record<string, string>`), `description` (localized object `Record<string, string>`), `main` (Boolean), `userId` (ref User).
- **Category**:
    - `id`, `slug` (String), `title` (localized object `Record<string, string>`), `description` (localized object `Record<string, string>`), `order` (Number), `parentId` (ref Category / self-referential FK), `colorId` (ref Color), `collectionId` (ref Collection), `userId` (ref User), `tagsIds` (Array of Tag IDs).
- **Color**:
    - `id`, `color` (hex/string), `userId` (ref User).
- **Media**:
    - `id`, `thumbnailUrl`, `originalUrl`, `width` (Number), `height` (Number), `orientation` (String / Enum), `userId` (ref User).
- **Tag**:
    - `id`, `slug` (String), `name` (localized object `Record<string, string>`), `userId` (ref User).
- **Post**:
    - `id`, `slug` (String), `title` (localized object `Record<string, string>`), `description` (localized object `Record<string, string>`), `media` (Array of PostMedia - stored as Embedded JSONB column), `posterId` (ref Media), `in_stock` (Boolean), `status` (String - Draft/Published/Archived), `collectionId` (ref Collection), `categoryId` (ref Category), `tagIds` (Array of Tag IDs), `userId` (ref User).
- **PostMedia (Embedded JSON inside Post.media array)**:
    - `id` (String / UUID), `order` (Number), `mediaId` (ref Media), `position` (Position object).
- **Position (Embedded JSON inside PostMedia)**:
    - `x` (Number), `y` (Number), `zoom` (Number).



> [!NOTE]
> **Relational Consistency**:
> A `Post` has a direct link to a `Collection` entity via `collection` (ref Collection). This allows direct, high-performance querying of all posts belonging to a collection without having to perform deep relational JOINs through categories.

---

**Important (Consistency when deleting):**
If an admin deletes a Tag or Category, run a background task to remove that ID from all associated posts. NoSQL lacks built-in ON DELETE CASCADE.

## Error Handling & Response Contracts

### REST API Response Contracts

**List response**
```json
{
  "data": [{}],
  "meta": {
    "page": 1,
    "nextPage": 2, // Number or null
    "prevPage": null, // Number or null
    "totalItems": 15
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
  "data": {},
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description message",
    "details": [{
      "field": "optional_field_name",
      "message": "specific validation message"
    }]
  }
}
```

---

### Error Handling Architecture

To ensure consistent and predictable API responses, the backend must implement a centralized operational error handling pattern:

1. **Custom Base Error Class**:
   - Establish an abstract custom error class (e.g., `BaseError`) extending the native `Error` class.
   - It must encapsulate a unique string-based `errorCode` (e.g., `INVALID_CREDENTIALS`) and an HTTP `statusCode` (e.g., `401`).
   - It must declare a `serialize()` method which formats the error object to match the API response contract.

2. **Concrete Operational Errors**:
   - All custom operational errors (e.g., `NotFoundError`, `InvalidCredentialsError`, `ValidationError`) must extend the base error class, automatically setting the appropriate HTTP status code and unique error code.

3. **Centralized Error Middleware**:
   - A single, global Express error-handling middleware must intercept all controller and service exceptions.
   - **Logging**: Every captured exception must be logged securely with the system logger, passing the message and error details.
   - **Operational Errors**: If the intercepted error is an instance of the custom base error class, the middleware must return its HTTP status code and serialized payload.
   - **Generic Failures**: For unhandled, generic system errors, the middleware must hide internal server details, return a `500 Internal Server Error` status, and send a standard fallback contract with a generic code (e.g., `COMMON_ERROR`).

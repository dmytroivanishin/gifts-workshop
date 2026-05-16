# Backend Architecture Rules

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: To be decided based on DB selection (Prisma, TypeORM, or custom).

## Layered Structure
- **Controllers**: Handle HTTP requests only. No business logic.
- **Services**: All business logic goes here.
- **Repositories**: Database access abstraction. Use interfaces to ensure the DB engine can be swapped later (PostgreSQL, MongoDB, etc.).
- **Storage Strategy**: Use the **Adapter/Strategy pattern** for file uploads (images). Create a generic interface so we can switch between Local Storage, S3, or Cloudinary without changing business logic.
- **Routes**: Use kebab-case. RESTful naming (POST /orders, not /createOrder).

## Authentication & Security
- **Strategy**: Google OAuth 2.0 with JWT tokens.
- **Token Management**:
  - Use **Access Tokens** (short-lived) and **Refresh Tokens** (long-lived).
  - Refresh Tokens must be stored in **HttpOnly, Secure, SameSite=Strict cookies** to prevent XSS.
  - Implement a `silent refresh` mechanism on the frontend to keep the session alive without manual login.
- **Single-Admin Mode**: No public registration. Only one specific hardcoded email is allowed to access the admin area.
- **Middleware**: A dedicated `authMiddleware` must verify the Access Token and check the email against the allowed admin email.

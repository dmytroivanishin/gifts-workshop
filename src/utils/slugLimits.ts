// The slug column is varchar(255); the room below it is for the "-12" suffix that makes a slug unique.
// Kept in its own file so the validation schemas (also loaded in the browser) do not pull in slug.ts
// and its server-only logger.
export const MAX_SLUG_LENGTH = 200;

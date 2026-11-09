import { BaseError } from "@/common/errors/base";
import { ConflictError } from "@/common/errors/conflict";
import { ValidationError } from "@/common/errors/validation";

interface PostgresErrorShape {
  code: string;
  detail?: string;
}

// Drizzle wraps the driver's error in `cause`; the driver's error is the one carrying the SQLSTATE code.
function findPostgresError(error: unknown): PostgresErrorShape | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; detail?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return { code: candidate.code, detail: typeof candidate.detail === "string" ? candidate.detail : undefined };
    }
    current = candidate.cause;
  }
  return undefined;
}

// A constraint the database enforces is the user's input being wrong, not the server failing, so it
// answers 4xx with a stable code the admin UI can translate. The raw message (SQL, parameters, values)
// is never put in the response.
export function mapDatabaseError(error: unknown): BaseError | undefined {
  const postgresError = findPostgresError(error);
  if (!postgresError) return undefined;

  switch (postgresError.code) {
    case "23505": // unique_violation
      return new ConflictError("A record with the same unique value already exists", "UNIQUE_VIOLATION");
    case "23503": // foreign_key_violation
      // "is not present in table" = the save points at something that does not exist;
      // "is still referenced from table" = the delete is blocked by something that uses it.
      return postgresError.detail?.includes("is still referenced")
        ? new ConflictError("The record is still used by another record", "REFERENCE_IN_USE")
        : new ValidationError("A referenced record does not exist", [{ message: "REFERENCE_NOT_FOUND" }]);
    case "22001": // string_data_right_truncation
      return new ValidationError("A value is too long", [{ message: "VALUE_TOO_LONG" }]);
    default:
      return undefined;
  }
}

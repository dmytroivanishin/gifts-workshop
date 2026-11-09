import { describe, expect, it } from "vitest";
import { mapDatabaseError } from "@/utils/databaseErrors";

// Drizzle wraps the driver's error in `cause`, so both shapes are covered.
const driverError = (code: string, detail?: string) => Object.assign(new Error("driver message with SQL and values"), { code, detail });
const wrapped = (inner: Error) => Object.assign(new Error("Failed query: insert ..."), { cause: inner });

describe("mapDatabaseError", () => {
  it("maps a unique violation to 409 UNIQUE_VIOLATION", () => {
    const mapped = mapDatabaseError(wrapped(driverError("23505")));
    expect(mapped?.statusCode).toBe(409);
    expect(mapped?.errorCode).toBe("UNIQUE_VIOLATION");
  });

  it("maps a foreign key violation on save (missing reference) to 400", () => {
    const mapped = mapDatabaseError(wrapped(driverError("23503", 'Key (tag_id)=(x) is not present in table "tags".')));
    expect(mapped?.statusCode).toBe(400);
    expect(JSON.stringify(mapped?.serialize())).toContain("REFERENCE_NOT_FOUND");
  });

  it("maps a foreign key violation on delete (still referenced) to 409 REFERENCE_IN_USE", () => {
    const mapped = mapDatabaseError(wrapped(driverError("23503", 'Key (id)=(x) is still referenced from table "posts".')));
    expect(mapped?.statusCode).toBe(409);
    expect(mapped?.errorCode).toBe("REFERENCE_IN_USE");
  });

  it("maps a too-long value to 400", () => {
    const mapped = mapDatabaseError(driverError("22001"));
    expect(mapped?.statusCode).toBe(400);
    expect(JSON.stringify(mapped?.serialize())).toContain("VALUE_TOO_LONG");
  });

  it("never puts the driver's message in the response", () => {
    const mapped = mapDatabaseError(wrapped(driverError("23505")));
    expect(JSON.stringify(mapped?.serialize())).not.toContain("driver message");
  });

  it("leaves other errors alone", () => {
    expect(mapDatabaseError(new Error("boom"))).toBeUndefined();
    expect(mapDatabaseError(driverError("08006"))).toBeUndefined();
    expect(mapDatabaseError("text")).toBeUndefined();
    expect(mapDatabaseError(undefined)).toBeUndefined();
  });
});

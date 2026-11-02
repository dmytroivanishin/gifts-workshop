import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseJsonBody, validateRequest } from "@/utils/validateRequest";
import { ValidationError } from "@/common/errors/validation";

describe("parseJsonBody", () => {
  it("returns the parsed body for valid JSON", async () => {
    const request = new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    await expect(parseJsonBody(request)).resolves.toEqual({ a: 1 });
  });

  it("throws a ValidationError for a malformed body instead of letting SyntaxError bubble", async () => {
    const request = new Request("http://localhost/x", { method: "POST", body: "{not json" });
    await expect(parseJsonBody(request)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("validateRequest", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number() });

  it("returns the parsed data when validation succeeds", async () => {
    const result = await validateRequest(schema, { name: "A", age: 5 });
    expect(result).toEqual({ name: "A", age: 5 });
  });

  it("throws a ValidationError with one detail per Zod issue", async () => {
    try {
      await validateRequest(schema, { name: "", age: "not-a-number" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const serialized = (error as ValidationError).serialize();
      expect(serialized.details).toHaveLength(2);
      expect(serialized.details.map(d => d.field)).toEqual(expect.arrayContaining(["name", "age"]));
    }
  });

  it("joins a nested error path with dots", async () => {
    const nested = z.object({ a: z.object({ b: z.string() }) });
    try {
      await validateRequest(nested, { a: { b: 123 } });
      expect.unreachable("should have thrown");
    } catch (error) {
      const serialized = (error as ValidationError).serialize();
      expect(serialized.details[0].field).toBe("a.b");
    }
  });

  it("re-throws a non-ZodError as-is", async () => {
    const throwing = z.object({}).transform(() => {
      throw new Error("boom");
    });
    await expect(validateRequest(throwing, {})).rejects.toThrow("boom");
  });
});

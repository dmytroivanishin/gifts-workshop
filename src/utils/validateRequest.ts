import { z, ZodError } from "zod";
import { ValidationError } from "@/common/errors/validation";

/**
 * Parses a request body as JSON, converting a malformed body into a clean 400
 * instead of letting the SyntaxError bubble up as a generic 500.
 */
export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Malformed JSON body");
  }
}

/**
 * Validates data against a Zod schema.
 * Throws a formatted ValidationError if validation fails.
 * 
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @returns The parsed and typed data
 */
export async function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      throw new ValidationError("Validation failed", details);
    }
    throw error;
  }
}

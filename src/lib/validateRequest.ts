import { z, ZodError } from "zod";
import { ValidationError } from "@/common/errors/validation";

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
      const details = error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new ValidationError("Validation failed", details);
    }
    throw error;
  }
}

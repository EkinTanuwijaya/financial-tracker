import { z } from "zod";

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data;
}

export function createValidationPipe<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => validateOrThrow(schema, data);
}

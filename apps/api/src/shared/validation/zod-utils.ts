/**
 * Zod Validation Utilities
 * @fileoverview Generic validation utilities for Zod schemas
 */

import type { ZodSchema, ZodTypeDef } from 'zod';

/**
 * Validation result type for consistent validation responses
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; errors: string[] };

/**
 * Helper function to format Zod error objects into readable strings
 *
 * @param errors - Array of Zod error objects
 * @returns Array of formatted error messages
 */
function formatZodErrors(errors: { path: (string | number)[]; message: string }[]): string[] {
  return errors.map((err) => {
    const field = err.path.join('.');
    return field ? `${field}: ${err.message}` : err.message;
  });
}

/**
 * Generic validation function using Zod schemas
 * Provides consistent validation result format across the application
 * Supports schemas with transformations (different input and output types)
 *
 * @param schema - Zod schema to validate against (may include transformations)
 * @param data - Data to validate
 * @returns Validation result with typed data or error messages
 *
 * @example
 * ```typescript
 * // Simple validation without transformation
 * const result = validateWithSchema(userSchema, userData);
 * if (result.success) {
 *   // result.data is fully typed
 *   console.log(result.data.email);
 * } else {
 *   // result.errors contains formatted error messages
 *   console.log(result.errors);
 * }
 *
 * // Validation with transformation
 * const schema = z.object({
 *   id: z.string().uuid().transform(id => UserId.of(id))
 * });
 * const result = validateWithSchema(schema, { id: "123-456" });
 * // result.data.id is now a UserId instance
 * ```
 */
export function validateWithSchema<TOutput, TInput = unknown>(
  schema: ZodSchema<TOutput, ZodTypeDef, TInput>,
  data: unknown
): ValidationResult<TOutput> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  const errors = formatZodErrors(result.error.errors);

  return {
    success: false,
    errors,
  };
}

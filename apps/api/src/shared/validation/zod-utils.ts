/**
 * Zod Validation Utilities
 * @fileoverview Generic validation utilities for Zod schemas
 */

import type { ZodSchema } from 'zod';

/**
 * Validation result type for consistent validation responses
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; errors: string[] };

/**
 * Generic validation function using Zod schemas
 * Provides consistent validation result format across the application
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with typed data or error messages
 *
 * @example
 * ```typescript
 * const result = validateWithSchema(userSchema, userData);
 * if (result.success) {
 *   // result.data is fully typed
 *   console.log(result.data.email);
 * } else {
 *   // result.errors contains formatted error messages
 *   console.log(result.errors);
 * }
 * ```
 */
export function validateWithSchema<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  // Format errors into readable messages
  const errors = result.error.errors.map((err) => {
    const field = err.path.join('.');
    return field ? `${field}: ${err.message}` : err.message;
  });

  return {
    success: false,
    errors,
  };
}

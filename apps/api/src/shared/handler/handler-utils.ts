/**
 * Handler Utilities
 *
 * Provides common patterns for use case handlers to eliminate duplication
 * and ensure consistent validation, error handling, and response patterns.
 */

import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { ZodError, ZodSchema } from 'zod';

/**
 * Validates input using a Zod schema and executes the handler if valid
 *
 * This eliminates the repetitive validation pattern across all handlers:
 * - Validates input with Zod schema
 * - Returns validation error if invalid
 * - Executes handler with validated data if valid
 *
 * @param schema - Zod schema for input validation
 * @param handler - Handler function to execute with validated input
 * @returns Function that validates input and executes handler
 *
 * @example
 * ```typescript
 * export const createUserHandler = validateAndHandle(
 *   createUserSchema,
 *   async (input, userRepository) => {
 *     // input is already validated and typed
 *     const user = User.create(input);
 *     await userRepository.save(user);
 *     return Result.ok({ user: user.toDTO() });
 *   }
 * );
 * ```
 */
export function validateAndHandle<TInput, TOutput, TDeps extends unknown[] = []>(
  schema: ZodSchema<TInput>,
  handler: (input: TInput, ...deps: TDeps) => Promise<Result<TOutput, Error>>
): (input: unknown, ...deps: TDeps) => Promise<Result<TOutput, Error>> {
  return async (input: unknown, ...deps: TDeps): Promise<Result<TOutput, Error>> => {
    try {
      // Validate input using Zod schema
      const validationResult = schema.safeParse(input);
      if (!validationResult.success) {
        return Result.fail(new ValidationError(formatZodError(validationResult.error)));
      }

      // Execute handler with validated input
      return await handler(validationResult.data, ...deps);
    } catch (error) {
      // Handle unexpected errors
      if (error instanceof Error) {
        return Result.fail(error);
      }
      return Result.fail(new Error('Unknown error occurred'));
    }
  };
}

/**
 * Format Zod validation errors into a readable message
 *
 * @param error - Zod validation error
 * @returns Formatted error message
 */
function formatZodError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  return issues.join(', ');
}

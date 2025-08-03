/**
 * Handler Utilities
 *
 * Provides common patterns for use case handlers to eliminate duplication
 * and ensure consistent validation, error handling, and response patterns.
 */

import type { AuthUser } from '@api/middleware/auth/auth-user';
import { ValidationError } from '@api/shared/errors';
import { Result } from '@api/shared/result';
import type { Context } from 'hono';
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

/**
 * Safely validates and retrieves authenticated user from Hono context
 *
 * This function provides runtime validation for user context to prevent
 * security issues and runtime errors from unsafe type assertions.
 * Use this instead of direct type assertion: `context.get('user') as AuthUser`
 *
 * @param context - Hono context that may contain authenticated user
 * @returns Validated AuthUser object
 * @throws ValidationError if user context is invalid or missing required properties
 *
 * @example
 * ```typescript
 * // Instead of unsafe type assertion:
 * // const user = context.get('user') as AuthUser;
 *
 * // Use safe validation:
 * const user = validateUserContext(context);
 * ```
 */
export function validateUserContext(context: Context): AuthUser {
  const user = context.get('user');

  // Check if user exists
  if (!user) {
    throw new ValidationError('User context is missing - authentication required');
  }

  // Check if user is an object
  if (typeof user !== 'object') {
    throw new ValidationError('User context is invalid - expected object');
  }

  // Validate required AuthUser properties
  if (!('sub' in user) || typeof user.sub !== 'string') {
    throw new ValidationError('User context is invalid - missing or invalid sub property');
  }

  if (!('roles' in user) || !Array.isArray(user.roles)) {
    throw new ValidationError('User context is invalid - missing or invalid roles property');
  }

  // Validate roles array contains only strings
  if (!user.roles.every((role) => typeof role === 'string')) {
    throw new ValidationError('User context is invalid - roles must be an array of strings');
  }

  // Validate optional email property when present
  if ('email' in user && user.email !== undefined && typeof user.email !== 'string') {
    throw new ValidationError('User context is invalid - email must be a string when present');
  }

  // Validate optional preferred_username property when present
  if (
    'preferred_username' in user &&
    user.preferred_username !== undefined &&
    typeof user.preferred_username !== 'string'
  ) {
    throw new ValidationError(
      'User context is invalid - preferred_username must be a string when present'
    );
  }

  // User has passed all validation checks, safe to cast
  return user as AuthUser;
}

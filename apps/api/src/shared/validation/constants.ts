/**
 * Shared validation constants
 * @fileoverview Common validation patterns and constants used across the application
 */

/**
 * Regular expression for validating UUID format
 * Matches standard UUID format: 8-4-4-4-12 hexadecimal characters
 * Case-insensitive
 *
 * Note: This regex accepts any UUID version (v1-v5), not just v4. While the
 * application generates UUID v4 using crypto.randomUUID(), we accept any valid
 * UUID format for flexibility (e.g., when importing data or integrating with
 * external systems that may use different UUID versions).
 *
 * @example
 * '123e4567-e89b-12d3-a456-426614174000' // valid
 * '123e4567-e89b-12d3-a456-42661417400g' // invalid (contains 'g')
 * '123e4567e89b12d3a456426614174000'     // invalid (missing hyphens)
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Helper function to validate UUID format
 * @param value - The string to validate
 * @returns true if the value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Shared validation constants
 * @fileoverview Common validation patterns and constants used across the application
 */

/**
 * Regular expression for validating UUID format
 * Matches standard UUID format: 8-4-4-4-12 hexadecimal characters
 * Case-insensitive
 *
 * @example
 * '123e4567-e89b-12d3-a456-426614174000' // valid
 * '123e4567-e89b-12d3-a456-42661417400g' // invalid (contains 'g')
 * '123e4567e89b12d3a456426614174000'     // invalid (missing hyphens)
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Regular expression for validating UUID v4 format specifically
 * More strict than UUID_REGEX - validates version and variant bits
 * The 13th character must be '4' (version 4)
 * The 17th character must be one of '8', '9', 'a', or 'b' (variant bits)
 *
 * @example
 * '123e4567-e89b-42d3-a456-426614174000' // valid v4
 * '123e4567-e89b-12d3-a456-426614174000' // invalid (not v4)
 */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Helper function to validate UUID format
 * @param value - The string to validate
 * @returns true if the value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Helper function to validate UUID v4 format
 * @param value - The string to validate
 * @returns true if the value is a valid UUID v4
 */
export function isValidUUIDv4(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

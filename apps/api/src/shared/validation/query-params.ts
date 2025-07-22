/**
 * Query Parameter Parsing Utilities
 * @fileoverview Shared utilities for parsing and transforming query parameters
 */

/**
 * Flexible boolean parser for query parameters
 * Accepts common boolean representations (case-insensitive):
 * - true: 'true', '1', 'yes'
 * - false: everything else
 *
 * @param value - The string value to parse as boolean
 * @returns boolean representation
 *
 * @example
 * parseFlexibleBoolean('true')  // true
 * parseFlexibleBoolean('TRUE')  // true
 * parseFlexibleBoolean('1')     // true
 * parseFlexibleBoolean('yes')   // true
 * parseFlexibleBoolean('false') // false
 * parseFlexibleBoolean('0')     // false
 * parseFlexibleBoolean('')      // false
 * parseFlexibleBoolean('no')    // false
 */
export function parseFlexibleBoolean(value: string): boolean {
  const normalizedValue = value.toLowerCase().trim();
  return ['true', '1', 'yes'].includes(normalizedValue);
}

/**
 * Parse comma-separated string into array of trimmed strings
 * Filters out empty strings after trimming
 *
 * @param value - Comma-separated string
 * @returns Array of trimmed non-empty strings, or undefined if input is empty
 *
 * @example
 * parseCommaSeparated('a,b,c')     // ['a', 'b', 'c']
 * parseCommaSeparated('a, b , c')  // ['a', 'b', 'c']
 * parseCommaSeparated('a,,c')      // ['a', 'c']
 * parseCommaSeparated('')          // undefined
 * parseCommaSeparated(' , , ')     // undefined
 */
export function parseCommaSeparated(value: string | undefined): string[] | undefined {
  if (!value) return undefined;

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : undefined;
}

/**
 * Parse numeric string with bounds validation
 *
 * @param value - String value to parse
 * @param defaultValue - Default value if parsing fails
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @returns Parsed and validated number
 *
 * @example
 * parseNumericWithBounds('10', 5, 1, 100)    // 10
 * parseNumericWithBounds('200', 5, 1, 100)   // 100 (clamped to max)
 * parseNumericWithBounds('0', 5, 1, 100)     // 1 (clamped to min)
 * parseNumericWithBounds('abc', 5, 1, 100)   // 5 (default)
 */
export function parseNumericWithBounds(
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;

  return Math.max(min, Math.min(max, parsed));
}

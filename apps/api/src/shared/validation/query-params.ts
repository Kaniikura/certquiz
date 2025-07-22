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
 * Parse numeric string with bounds validation and automatic clamping
 *
 * **IMPORTANT**: This function performs SILENT CLAMPING of out-of-range values.
 * Values outside the specified bounds are automatically adjusted to fit within
 * the range rather than being rejected or throwing errors.
 *
 * Behavior:
 * - Valid numbers within bounds: returned as-is
 * - Numbers below minimum: clamped to minimum value
 * - Numbers above maximum: clamped to maximum value
 * - Invalid/unparseable input: returns default value
 *
 * This design choice prioritizes user experience by ensuring the application
 * continues to function with reasonable values rather than failing on edge cases.
 *
 * @param value - String value to parse (undefined/null treated as invalid)
 * @param defaultValue - Default value returned when parsing fails
 * @param min - Minimum allowed value (inclusive) - values below this are clamped UP
 * @param max - Maximum allowed value (inclusive) - values above this are clamped DOWN
 * @returns Parsed number guaranteed to be within [min, max] range, or defaultValue if parsing fails
 *
 * @example
 * // Normal case: value within bounds
 * parseNumericWithBounds('10', 5, 1, 100)    // 10
 *
 * // Clamping cases: out-of-range values are silently adjusted
 * parseNumericWithBounds('200', 5, 1, 100)   // 100 (clamped to max)
 * parseNumericWithBounds('0', 5, 1, 100)     // 1 (clamped to min)
 * parseNumericWithBounds('-50', 5, 1, 100)   // 1 (clamped to min)
 *
 * // Default cases: invalid input uses fallback
 * parseNumericWithBounds('abc', 5, 1, 100)   // 5 (default - parsing failed)
 * parseNumericWithBounds('', 10, 1, 100)     // 10 (default - empty string)
 * parseNumericWithBounds(undefined, 15, 1, 100) // 15 (default - undefined input)
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

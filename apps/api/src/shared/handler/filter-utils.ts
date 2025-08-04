/**
 * Filter Building Utilities
 * @fileoverview Common patterns for building filter objects from request parameters
 */

/**
 * Type for filter transform functions
 */
type FilterTransform = (value: unknown) => unknown;

/**
 * Type for filter mapping configuration
 */
type FilterMapping = Record<string, string | FilterTransform>;

/**
 * Build filters with field mapping
 * Maps parameter names to different filter field names
 *
 * @param params - The input parameters
 * @param mapping - Object mapping param names to filter field names
 * @returns Filter object with mapped field names
 *
 * @example
 * ```typescript
 * const filters = buildMappedFilters(params, {
 *   dateFrom: 'startDate',
 *   dateTo: 'endDate',
 *   status: (value) => StatusToQuestionStatus[value]
 * });
 * ```
 */
export function buildMappedFilters<TParams>(
  params: TParams,
  mapping: FilterMapping
): Record<string, unknown> | undefined {
  const filters: Record<string, unknown> = {};
  let hasFilters = false;

  for (const [paramKey, mapTo] of Object.entries(mapping)) {
    const value = (params as Record<string, unknown>)[paramKey];
    if (value !== undefined) {
      hasFilters = true;
      if (typeof mapTo === 'function') {
        filters[paramKey] = mapTo(value);
      } else {
        filters[mapTo] = value;
      }
    }
  }

  return hasFilters ? filters : undefined;
}

/**
 * Extract filter fields from params
 * Useful for simple cases where param names match filter names
 *
 * @param params - The input parameters
 * @param fields - Array of field names to extract
 * @returns Filter object with extracted fields
 *
 * @example
 * ```typescript
 * const filters = extractFilterFields(params, ['search', 'role', 'isActive']);
 * ```
 */
export function extractFilterFields<T>(params: T, fields: (keyof T)[]): Partial<T> | undefined {
  const filters: Partial<T> = {};
  let hasFilters = false;

  for (const field of fields) {
    if (params[field] !== undefined) {
      hasFilters = true;
      filters[field] = params[field];
    }
  }

  return hasFilters ? filters : undefined;
}

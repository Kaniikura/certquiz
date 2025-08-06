/**
 * Pagination Utilities
 * @fileoverview Common patterns for handling pagination parameters
 */

/**
 * Default pagination configuration
 */
const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: 20,
  orderBy: 'createdAt',
  orderDir: 'desc' as const,
} as const;

/**
 * Build complete pagination options for repository calls
 *
 * @param params - The input parameters
 * @param overrides - Optional overrides for specific fields
 * @returns Complete pagination options object
 *
 * @example
 * ```typescript
 * const paginationOptions = buildPaginationOptions(params, {
 *   orderBy: 'startedAt',
 *   orderDir: 'asc'
 * });
 * ```
 */
export function buildPaginationOptions<
  T extends {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
  },
>(
  params: T,
  overrides?: Partial<{
    orderBy: string;
    orderDir: 'asc' | 'desc';
  }>
): {
  page: number;
  pageSize: number;
  orderBy: string;
  orderDir: 'asc' | 'desc';
} {
  return {
    page: params.page ?? DEFAULT_PAGINATION.page,
    pageSize: params.pageSize ?? DEFAULT_PAGINATION.pageSize,
    orderBy: overrides?.orderBy ?? params.orderBy ?? DEFAULT_PAGINATION.orderBy,
    orderDir: overrides?.orderDir ?? params.orderDir ?? DEFAULT_PAGINATION.orderDir,
  };
}

/**
 * Repository Call Pattern Utilities
 * @fileoverview Common patterns for repository method calls
 */

import type { PaginatedResult } from '../types/pagination';

/**
 * Create a repository fetch function with standard parameters
 *
 * @param methodName - The repository method to call
 * @param buildOptions - Function to build method options
 * @returns Fetch function for use in handlers
 *
 * @example
 * ```typescript
 * const fetchData = createRepositoryFetch(
 *   'findAllForAdmin',
 *   (filters, pagination) => ({
 *     ...pagination,
 *     filters,
 *     orderBy: 'startedAt',
 *     orderDir: 'desc'
 *   })
 * );
 * ```
 */
export function createRepositoryFetch<
  TMethodName extends string | number | symbol,
  TFilters,
  TResult,
  TOptions,
  TRepo extends Record<TMethodName, (options: TOptions) => Promise<PaginatedResult<TResult>>>,
>(
  methodName: TMethodName,
  buildOptions: (
    filters: TFilters | undefined,
    pagination: { page: number; pageSize: number }
  ) => TOptions
) {
  return async (
    repo: TRepo,
    filters: TFilters | undefined,
    params: { page?: number; pageSize?: number }
  ): Promise<PaginatedResult<TResult>> => {
    const { page = 1, pageSize = 20 } = params;
    const options = buildOptions(filters, { page, pageSize });

    return repo[methodName](options);
  };
}

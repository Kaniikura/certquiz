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
export function createRepositoryFetch<TRepo, TFilters, TResult>(
  methodName: keyof TRepo,
  buildOptions: (
    filters: TFilters | undefined,
    pagination: { page: number; pageSize: number }
  ) => unknown
) {
  return async (
    repo: unknown,
    filters: TFilters | undefined,
    params: { page?: number; pageSize?: number }
  ): Promise<PaginatedResult<TResult>> => {
    const { page = 1, pageSize = 20 } = params;
    const options = buildOptions(filters, { page, pageSize });

    const method = (repo as TRepo)[methodName];
    if (typeof method !== 'function') {
      throw new Error(`Method ${String(methodName)} is not a function on repository`);
    }

    return method.call(repo as TRepo, options);
  };
}

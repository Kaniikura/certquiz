/**
 * Shared Pagination Types
 * @fileoverview Common types for paginated responses across the application
 */

/**
 * Generic paginated response structure
 * Used across all list endpoints for consistent pagination
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Repository-level pagination result
 * Used internally by repositories before transformation
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Utility function to calculate total pages
 */
function calculateTotalPages(total: number, pageSize: number): number {
  return total > 0 ? Math.ceil(total / pageSize) : 0;
}

/**
 * Transform repository result to standard paginated response
 */
export function toPaginatedResponse<T>(result: PaginatedResult<T>): PaginatedResponse<T> {
  return {
    ...result,
    totalPages: calculateTotalPages(result.total, result.pageSize),
  };
}

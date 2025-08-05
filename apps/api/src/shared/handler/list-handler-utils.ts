/**
 * List Handler Utilities
 * @fileoverview Generic utilities for creating paginated list handlers
 */

import { ValidationError } from '@api/shared/errors';
import type { PaginatedResponse, PaginatedResult } from '@api/shared/types/pagination';
import { toPaginatedResponse } from '@api/shared/types/pagination';
import type { ValidationResult } from '@api/shared/validation/zod-utils';
import { validateWithSchema } from '@api/shared/validation/zod-utils';
import type { ZodSchema } from 'zod';

/**
 * Configuration for creating a list handler
 */
interface ListHandlerConfig<
  TParams,
  TItem,
  TFilters = unknown,
  TRepoResult = unknown,
  TSummary = unknown,
> {
  /** Zod schema for validating input parameters */
  schema: ZodSchema<TParams>;
  /** Function to build repository filters from validated params */
  buildFilters: (params: TParams) => TFilters;
  /** Function to fetch data from repository */
  fetchData: (filters: TFilters) => Promise<PaginatedResult<TRepoResult>>;
  /** Function to transform repository items to response items */
  transformItem: (item: TRepoResult) => TItem;
  /** Optional function to calculate additional summary data */
  calculateSummary?: (items: TItem[], total: number) => TSummary;
  /** Optional custom validation function */
  customValidate?: (params: TParams) => ValidationResult<TParams>;
  /** Optional pre-validated parameters to skip validation */
  preValidatedParams?: TParams;
}

/**
 * Create a paginated list handler with common patterns
 * Reduces code duplication across list endpoints
 *
 * @param config - Configuration for the list handler
 * @returns Handler function that processes list requests
 *
 * @example
 * ```typescript
 * export const listUsersHandler = createPaginatedListHandler({
 *   schema: listUsersSchema,
 *   buildFilters: (params) => ({
 *     search: params.search,
 *     role: params.role,
 *     isActive: params.isActive
 *   }),
 *   fetchData: (filters) => userRepo.findAllPaginated(filters),
 *   transformItem: (user) => ({
 *     userId: user.id,
 *     email: user.email,
 *     // ... other transformations
 *   })
 * });
 * ```
 */
function createPaginatedListHandler<
  TParams,
  TItem,
  TFilters = unknown,
  TRepoResult = unknown,
  TSummary = unknown,
>(
  config: ListHandlerConfig<TParams, TItem, TFilters, TRepoResult, TSummary>
): (params: unknown) => Promise<PaginatedResponse<TItem> & { summary?: TSummary }> {
  return async (params: unknown): Promise<PaginatedResponse<TItem> & { summary?: TSummary }> => {
    // 1. Use pre-validated params if available, otherwise validate input parameters
    let validatedParams: TParams;

    if (config.preValidatedParams) {
      validatedParams = config.preValidatedParams;
    } else {
      const validation = config.customValidate
        ? config.customValidate(params as TParams)
        : validateWithSchema(config.schema, params);

      if (!validation.success) {
        throw new ValidationError(validation.errors.join(', '));
      }

      validatedParams = validation.data;
    }

    // 2. Build filters from validated params
    const filters = config.buildFilters(validatedParams);

    // 3. Fetch data from repository
    const result = await config.fetchData(filters);

    // 4. Transform repository items to response format
    const transformedItems = result.items.map(config.transformItem);

    // 5. Build base response
    const response = toPaginatedResponse({
      items: transformedItems,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });

    // 6. Add optional summary if calculator provided
    if (config.calculateSummary) {
      const summary = config.calculateSummary(transformedItems, result.total);
      return { ...response, summary };
    }

    return response;
  };
}

/**
 * Configuration for list handler with unit of work pattern
 */
interface ListHandlerWithUowConfig<
  TParams,
  TItem,
  TUnitOfWork,
  TFilters = unknown,
  TRepoResult = unknown,
  TRepo = unknown,
  TSummary = unknown,
> extends Omit<ListHandlerConfig<TParams, TItem, TFilters, TRepoResult, TSummary>, 'fetchData'> {
  /** Function to get repository from unit of work */
  getRepository: (unitOfWork: TUnitOfWork) => TRepo;
  /** Function to fetch data using repository */
  fetchData: (
    repo: TRepo,
    filters: TFilters,
    params: TParams
  ) => Promise<PaginatedResult<TRepoResult>>;
}

/**
 * Create a paginated list handler that uses unit of work pattern
 * Common in admin handlers that need multiple repositories
 *
 * @param config - Configuration for the list handler
 * @returns Handler function that accepts params and unit of work
 */
export function createPaginatedListHandlerWithUow<
  TParams,
  TItem,
  TUnitOfWork,
  TFilters = unknown,
  TRepoResult = unknown,
  TRepo = unknown,
  TSummary = unknown,
>(
  config: ListHandlerWithUowConfig<
    TParams,
    TItem,
    TUnitOfWork,
    TFilters,
    TRepoResult,
    TRepo,
    TSummary
  >
): (
  params: unknown,
  unitOfWork: TUnitOfWork
) => Promise<PaginatedResponse<TItem> & { summary?: TSummary }> {
  return async (
    params: unknown,
    unitOfWork: TUnitOfWork
  ): Promise<PaginatedResponse<TItem> & { summary?: TSummary }> => {
    // 1. Validate input parameters once at the beginning
    const validation = config.customValidate
      ? config.customValidate(params as TParams)
      : validateWithSchema(config.schema, params);

    if (!validation.success) {
      throw new ValidationError(validation.errors.join(', '));
    }

    const validatedParams = validation.data;

    // 2. Get repository from unit of work
    const repository = config.getRepository(unitOfWork);

    // 3. Create a modified config with pre-validated params to skip re-validation
    const modifiedConfig: ListHandlerConfig<TParams, TItem, TFilters, TRepoResult, TSummary> = {
      ...config,
      preValidatedParams: validatedParams,
      fetchData: async (filters: TFilters) => {
        return config.fetchData(repository, filters, validatedParams);
      },
    };

    // 4. Use the standard handler with modified config
    const handler = createPaginatedListHandler(modifiedConfig);

    return handler(validatedParams);
  };
}

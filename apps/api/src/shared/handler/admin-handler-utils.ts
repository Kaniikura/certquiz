/**
 * Admin handler utilities for common CRUD operations
 * @fileoverview Provides utilities to reduce boilerplate in admin action handlers
 */

import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import { NotFoundError, ValidationError } from '@api/shared/errors';
import { validateWithSchema } from '@api/shared/validation/zod-utils';
import type { ZodSchema } from 'zod';

/**
 * Configuration for creating an admin action handler
 * @template TParams - The input parameters type
 * @template TEntity - The entity type being operated on
 * @template TRepo - The repository type
 * @template TResponse - The response type
 * @template TUnitOfWork - The unit of work type (defaults to IUnitOfWork)
 * @public
 */
export interface AdminActionHandlerConfig<
  TParams,
  TEntity,
  TRepo,
  TResponse,
  TUnitOfWork = IUnitOfWork,
> {
  /**
   * Zod schema for validating input parameters
   */
  schema: ZodSchema<TParams>;

  /**
   * Function to get the repository from the unit of work
   */
  getRepository: (unitOfWork: TUnitOfWork) => TRepo;

  /**
   * Function to find the entity by ID or other criteria
   * Should return null if entity not found
   */
  findEntity: (repo: TRepo, params: TParams) => Promise<TEntity | null>;

  /**
   * Optional function to validate business rules before executing the action
   * Should throw appropriate errors if validation fails
   */
  validateBusinessRules?: (entity: TEntity, params: TParams) => void | Promise<void>;

  /**
   * Function to execute the main action
   */
  executeAction: (repo: TRepo, entity: TEntity, params: TParams) => Promise<void>;

  /**
   * Function to build the response after successful execution
   */
  buildResponse: (entity: TEntity, params: TParams) => TResponse;

  /**
   * Optional custom error message for when entity is not found
   */
  notFoundMessage?: string;
}

/**
 * Creates a standardized admin action handler with common patterns:
 * - Input validation
 * - Entity retrieval
 * - Business rule validation
 * - Action execution
 * - Audit response generation
 *
 * @template TParams - The input parameters type
 * @template TEntity - The entity type being operated on
 * @template TRepo - The repository type
 * @template TResponse - The response type
 * @template TUnitOfWork - The unit of work type
 *
 * @param config - Configuration object for the handler
 * @returns Handler function that accepts params and unit of work
 *
 * @example
 * ```typescript
 * export const deleteQuizHandler = createAdminActionHandler({
 *   schema: deleteQuizSchema,
 *   getRepository: (uow) => uow.getRepository(QUIZ_REPO_TOKEN),
 *   findEntity: async (repo, params) => {
 *     const quizSessionId = QuizSessionId.of(params.quizId);
 *     return repo.findById(quizSessionId);
 *   },
 *   validateBusinessRules: (quiz) => {
 *     if (quiz.state === QuizState.InProgress) {
 *       throw new AdminPermissionError('Cannot delete active quiz session');
 *     }
 *   },
 *   executeAction: async (repo, quiz, params) => {
 *     await repo.deleteWithCascade(quiz.id);
 *   },
 *   buildResponse: (quiz, params) => ({
 *     success: true,
 *     quizId: params.quizId,
 *     previousState: quiz.state.toString(),
 *     deletedBy: params.deletedBy,
 *     reason: params.reason,
 *     deletedAt: new Date(),
 *   }),
 * });
 * ```
 */
export function createAdminActionHandler<
  TParams,
  TEntity,
  TRepo,
  TResponse,
  TUnitOfWork = IUnitOfWork,
>(
  config: AdminActionHandlerConfig<TParams, TEntity, TRepo, TResponse, TUnitOfWork>
): (params: TParams, unitOfWork: TUnitOfWork) => Promise<TResponse> {
  return async (params: TParams, unitOfWork: TUnitOfWork): Promise<TResponse> => {
    // Step 1: Validate input parameters
    const validationResult = validateWithSchema(config.schema, params);
    if (!validationResult.success) {
      throw new ValidationError(validationResult.errors[0]);
    }

    // Step 2: Get repository from unit of work
    const repository = config.getRepository(unitOfWork);

    // Step 3: Find the entity
    const entity = await config.findEntity(repository, params);
    if (!entity) {
      throw new NotFoundError(config.notFoundMessage || 'Entity not found');
    }

    // Step 4: Validate business rules (if provided)
    if (config.validateBusinessRules) {
      await config.validateBusinessRules(entity, params);
    }

    // Step 5: Execute the main action
    await config.executeAction(repository, entity, params);

    // Step 6: Build and return the response
    return config.buildResponse(entity, params);
  };
}

/**
 * Configuration for creating an admin action handler without entity retrieval
 * Used for actions that don't operate on existing entities (e.g., system stats)
 *
 * @template TParams - The input parameters type
 * @template TResponse - The response type
 * @template TUnitOfWork - The unit of work type (defaults to IUnitOfWork)
 * @public
 */
export interface SimpleAdminActionHandlerConfig<TParams, TResponse, TUnitOfWork = IUnitOfWork> {
  /**
   * Optional Zod schema for validating input parameters
   */
  schema?: ZodSchema<TParams>;

  /**
   * Function to execute the action and return the response
   */
  executeAction: (unitOfWork: TUnitOfWork, params: TParams) => Promise<TResponse>;
}

/**
 * Creates a simplified admin action handler for operations that don't require entity retrieval
 *
 * @template TParams - The input parameters type
 * @template TResponse - The response type
 * @template TUnitOfWork - The unit of work type
 *
 * @param config - Configuration object for the handler
 * @returns Handler function that accepts params and unit of work
 * @public
 */
export function createSimpleAdminActionHandler<TParams, TResponse, TUnitOfWork = IUnitOfWork>(
  config: SimpleAdminActionHandlerConfig<TParams, TResponse, TUnitOfWork>
): (params: TParams, unitOfWork: TUnitOfWork) => Promise<TResponse> {
  return async (params: TParams, unitOfWork: TUnitOfWork): Promise<TResponse> => {
    // Validate input parameters if schema provided
    if (config.schema) {
      const validationResult = config.schema.safeParse(params);
      if (!validationResult.success) {
        throw new ValidationError(validationResult.error.errors[0].message);
      }
    }

    // Execute the action and return the response
    return config.executeAction(unitOfWork, params);
  };
}

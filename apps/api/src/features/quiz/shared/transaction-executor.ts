/**
 * Transaction executor utility for quiz feature
 * @fileoverview Provides a generic transaction wrapper for handler execution
 */

import { withTransaction } from '@api/infra/unit-of-work';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { DrizzleQuizRepository } from '../domain/repositories/DrizzleQuizRepository';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import { QuizSessionId, UserId } from '../domain/value-objects/Ids';

/**
 * Transaction context provided to handlers
 */
export interface TransactionContext {
  /** Quiz repository instance */
  quizRepository: IQuizRepository;
  /** User ID value object */
  userId: UserId;
  /** Optional session ID for operations that require it */
  sessionId?: QuizSessionId;
}

/**
 * Parameters for transaction execution
 */
export interface TransactionParams {
  /** User ID string */
  userSub: string;
  /** Optional session ID string */
  sessionIdParam?: string;
  /** Logger instance */
  logger: LoggerPort;
}

/**
 * Handler function that executes within a transaction
 */
export type TransactionHandler<TResult> = (context: TransactionContext) => Promise<TResult>;

/**
 * Executes a handler function within a database transaction
 * Handles repository creation and ID conversions
 *
 * @param handler - Function to execute within transaction
 * @param params - Transaction parameters
 * @returns Handler result
 */
export async function executeInTransaction<TResult>(
  handler: TransactionHandler<TResult>,
  params: TransactionParams
): Promise<TResult> {
  return withTransaction(async (trx) => {
    // Create repository with transaction context
    const quizRepository = new DrizzleQuizRepository(trx, params.logger);

    // Convert IDs to value objects
    const userId = UserId.of(params.userSub);
    const sessionId = params.sessionIdParam ? QuizSessionId.of(params.sessionIdParam) : undefined;

    // Create context and execute handler
    const context: TransactionContext = {
      quizRepository,
      userId,
      sessionId,
    };

    return handler(context);
  });
}

/**
 * Type-safe handler creator for specific handler signatures
 * Useful for creating specialized transaction executors
 */
export function createTransactionExecutor<TArgs extends unknown[], TResult>(
  handlerFactory: (...args: TArgs) => TransactionHandler<TResult>
) {
  return async (args: TArgs, params: TransactionParams): Promise<TResult> => {
    const handler = handlerFactory(...args);
    return executeInTransaction(handler, params);
  };
}

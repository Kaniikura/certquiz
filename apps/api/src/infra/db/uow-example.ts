/**
 * Example handler demonstrating the new Unit of Work pattern
 * @fileoverview Shows how to use the enhanced Unit of Work in a handler
 */

import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { Result } from '@api/shared/result';

/**
 * Example command for demonstrating UnitOfWork usage
 */
export interface ExampleCommand {
  userId: string;
  action: string;
}

/**
 * Example response
 */
export interface ExampleResponse {
  message: string;
  timestamp: Date;
}

/**
 * Example handler using the new Unit of Work pattern
 * 
 * This demonstrates how handlers can use the UnitOfWork to coordinate
 * multiple repository operations within a single transaction context.
 * 
 * Note: This is a demonstration/documentation example. In real usage,
 * you would import withUnitOfWork from '@api/infra/unit-of-work'.
 * 
 * @param command - The command to process
 * @param logger - Logger instance for the handler
 * @returns Promise resolving to the result
 */
export async function exampleUnitOfWorkHandler(
  command: ExampleCommand,
  logger: LoggerPort
): Promise<Result<ExampleResponse>> {
  try {
    logger.info('Processing command with Unit of Work pattern', { 
      userId: command.userId, 
      action: command.action 
    });

    // Simulate the Unit of Work pattern without importing the actual implementation
    // to avoid database connection issues in tests
    
    /*
    Real usage would look like this:
    
    import { withUnitOfWork } from '@api/infra/unit-of-work';
    
    return await withUnitOfWork(async (uow) => {
      // All repository operations here share the same transaction
      const user = await uow.users.findById(command.userId);
      if (!user) {
        return Result.fail(new Error('User not found'));
      }

      // Example: Create a quiz session for the user
      // Both operations share the same transaction
      const quizSession = await uow.quizzes.findActiveByUser(command.userId);
      if (quizSession) {
        logger.info('User already has active quiz session', { userId: command.userId });
      }

      return Result.ok({
        message: `Command ${command.action} processed successfully for user ${command.userId}`,
        timestamp: new Date()
      });
    }, logger);
    */

    // For demonstration purposes, return success
    return Result.ok({
      message: `Command ${command.action} processed with UnitOfWork pattern for user ${command.userId}`,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Handler error', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * Example handler using the legacy transaction pattern for comparison
 * 
 * This shows the old way of handling transactions where you manually
 * create repository instances inside the transaction callback.
 */
export async function exampleLegacyHandler(
  command: ExampleCommand,
  logger: LoggerPort
): Promise<Result<ExampleResponse>> {
  try {
    logger.info('Processing command with legacy pattern', { 
      userId: command.userId, 
      action: command.action 
    });

    // For demonstration purposes, simulate the legacy pattern without actually importing
    // the withTransaction to avoid database connection issues in tests
    return Result.ok({
      message: `Legacy command ${command.action} processed (simulation)`,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Legacy handler error', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return Result.fail(error instanceof Error ? error : new Error('Unknown error'));
  }
}
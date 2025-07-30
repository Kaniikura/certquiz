/**
 * Handler Utilities for Unit of Work Pattern
 *
 * Provides utility functions to simplify the use of Unit of Work pattern
 * in route handlers, reducing boilerplate and ensuring consistent transaction
 * management across the application.
 */

import type { IUnitOfWork } from '@api/infra/db/IUnitOfWork';
import type { IUnitOfWorkProvider } from '@api/infra/db/IUnitOfWorkProvider';

/**
 * Execute an operation within a Unit of Work transaction context
 *
 * This function simplifies the use of Unit of Work pattern in route handlers by
 * delegating to the provided Unit of Work provider. The provider handles all
 * details of transaction management, allowing this function to remain simple
 * and framework-agnostic.
 *
 * @param provider - Unit of Work provider that manages transaction lifecycle
 * @param operation - Async function to execute within the transaction
 * @returns The result of the operation
 *
 * @example
 * ```typescript
 * export async function createUserHandler(
 *   provider: IUnitOfWorkProvider,
 *   input: CreateUserInput
 * ) {
 *   const result = await executeWithUnitOfWork(provider, async (uow) => {
 *     const userRepo = uow.getRepository(USER_REPO_TOKEN);
 *     const user = User.create(input);
 *     await userRepo.save(user);
 *     return user;
 *   });
 *
 *   return { success: true, data: result };
 * }
 * ```
 */
export async function executeWithUnitOfWork<T>(
  provider: IUnitOfWorkProvider,
  operation: (uow: IUnitOfWork) => Promise<T>
): Promise<T> {
  return provider.execute(operation);
}

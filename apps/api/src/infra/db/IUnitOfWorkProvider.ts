/**
 * Unit of Work Provider Interface
 *
 * @deprecated Use IDatabaseContext instead. This interface will be removed in a future version.
 * IDatabaseContext provides a more intuitive API while internally using UnitOfWork components.
 *
 * Migration guide:
 * ```typescript
 * // Old pattern:
 * const result = await provider.execute(async (uow) => {
 *   const userRepo = uow.getRepository(USER_REPO_TOKEN);
 *   const user = await userRepo.findById(userId);
 *   await userRepo.save(user);
 *   return user;
 * });
 *
 * // New pattern:
 * const result = await dbContext.withinTransaction(async (ctx) => {
 *   const userRepo = ctx.getRepository(USER_REPO_TOKEN);
 *   const user = await userRepo.findById(userId);
 *   await userRepo.save(user);
 *   return user;
 * });
 * ```
 *
 * Provides an abstraction for executing operations within a Unit of Work context.
 * This allows for dependency injection of different implementations (e.g., real database
 * transactions vs in-memory test implementations) without environment-based switching.
 */

import type { IUnitOfWork } from './IUnitOfWork';

/**
 * Provider interface for Unit of Work pattern
 *
 * Implementations of this interface handle the creation and lifecycle management
 * of Unit of Work instances, abstracting away the details of transaction handling.
 */
export interface IUnitOfWorkProvider {
  /**
   * Execute an operation within a Unit of Work transaction context
   *
   * @param operation - Async function to execute with a Unit of Work instance
   * @returns The result of the operation
   * @throws Any error thrown by the operation will be propagated after rollback
   *
   * @example
   * ```typescript
   * const result = await provider.execute(async (uow) => {
   *   const userRepo = uow.getUserRepository();
   *   const user = await userRepo.findById(userId);
   *   user.updateProfile(data);
   *   await userRepo.save(user);
   *   return user;
   * });
   * ```
   */
  execute<T>(operation: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}

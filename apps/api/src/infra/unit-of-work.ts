/**
 * Unit of Work pattern facade
 *
 * This provides a stable import surface for the Unit of Work pattern,
 * hiding the database-specific implementation details. Handlers and
 * application code should import from this facade rather than directly
 * from the db module.
 *
 * @example
 * ```typescript
 * import { withUnitOfWork } from '@/infra/unit-of-work';
 *
 * export async function handler(cmd: StartQuizCommand, logger: LoggerPort) {
 *   return withUnitOfWork(async (uow) => {
 *     const user = await uow.users.findById(cmd.userId);
 *     const quiz = await uow.quizzes.save(newQuiz);
 *     // All operations share the same transaction
 *   }, logger);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Legacy pattern (still supported)
 * import { withTransaction } from '@/infra/unit-of-work';
 *
 * export async function handler(cmd: StartQuizCommand) {
 *   return withTransaction(async (trx) => {
 *     const repo = new DrizzleQuizRepository(trx, logger);
 *     // business logic here
 *   });
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Testing with custom repositories
 * import { withUnitOfWork } from '@/infra/unit-of-work';
 *
 * const result = await withUnitOfWork(async (uow) => {
 *   // Use mock repositories in test
 * }, logger, {
 *   userRepository: (tx, logger) => mockUserRepository,
 *   quizRepository: (tx, logger) => mockQuizRepository,
 * });
 * ```
 */

export {
  type RepositoryFactory,
  type TransactionContext,
  UnitOfWork,
  withTransaction,
  withUnitOfWork,
} from './db/uow';

// Note: RepositoryFactory is re-exported from the implementation for convenience

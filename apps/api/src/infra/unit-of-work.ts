import { db } from './db/client';

/**
 * Unit of Work pattern implementation using Drizzle's transaction
 * 
 * This ensures all database operations within a handler participate
 * in the same transaction, providing consistency and atomicity.
 * 
 * @example
 * ```typescript
 * export async function handler(c: Context) {
 *   return withTransaction(async (trx) => {
 *     const userRepo = new DrizzleUserRepository(trx);
 *     const quizRepo = new DrizzleQuizRepository(trx);
 *     
 *     // All operations share the same transaction
 *     const user = await userRepo.findById(userId);
 *     const quiz = await quizRepo.save(newQuiz);
 *   });
 * }
 * ```
 */
export const withTransaction = db.transaction.bind(db);
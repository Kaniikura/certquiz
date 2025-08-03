/**
 * Quiz repository interface for domain layer
 * @fileoverview Persistence abstraction for QuizSession aggregate
 */

import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { QuizSession } from '../aggregates/QuizSession';
import type { QuizSessionId } from '../value-objects/Ids';

export interface IQuizRepository {
  /**
   * Find a quiz session by its ID
   */
  findById(id: QuizSessionId): Promise<QuizSession | null>;

  /**
   * Save a quiz session (create or update)
   */
  save(session: QuizSession): Promise<void>;

  /**
   * Find expired sessions for scheduled cleanup
   * @param now Current time for expiration check
   * @param limit Maximum number of sessions to return
   */
  findExpiredSessions(now: Date, limit: number): Promise<QuizSession[]>;

  /**
   * Find active session for a user (if any)
   */
  findActiveByUser(userId: UserId): Promise<QuizSession | null>;
}

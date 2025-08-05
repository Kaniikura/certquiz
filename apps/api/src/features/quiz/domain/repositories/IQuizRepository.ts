/**
 * Quiz repository interface for domain layer
 * @fileoverview Persistence abstraction for QuizSession aggregate
 */

import type { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { PaginatedResult } from '@api/shared/types/pagination';
import type { QuizSession } from '../aggregates/QuizSession';
import type { QuizSessionId } from '../value-objects/Ids';
import type { QuizState } from '../value-objects/QuizState';

/**
 * Admin-specific quiz data with user information
 */
export interface QuizWithUserInfo {
  sessionId: string;
  userId: string;
  userEmail: string;
  state: QuizState;
  score: number | null;
  questionCount: number;
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * Admin quiz filtering parameters
 */
export interface AdminQuizFilters {
  state?: QuizState;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Admin quiz query parameters
 */
export interface AdminQuizParams {
  page: number;
  pageSize: number;
  filters?: AdminQuizFilters;
  orderBy?: 'startedAt' | 'completedAt';
  orderDir?: 'asc' | 'desc';
}

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

  /**
   * Admin statistics: Count total number of quiz sessions
   */
  countTotalSessions(): Promise<number>;

  /**
   * Admin statistics: Count currently active quiz sessions
   */
  countActiveSessions(): Promise<number>;

  /**
   * Admin statistics: Get average quiz score (0-1)
   */
  getAverageScore(): Promise<number>;

  /**
   * Admin oversight: Find all quiz sessions with pagination and filtering
   * Includes user information for admin management
   */
  findAllForAdmin(params: AdminQuizParams): Promise<PaginatedResult<QuizWithUserInfo>>;

  /**
   * Admin management: Delete a quiz session and all related data
   * Performs cascading deletion of answers, events, and session data
   */
  deleteWithCascade(sessionId: QuizSessionId): Promise<void>;
}

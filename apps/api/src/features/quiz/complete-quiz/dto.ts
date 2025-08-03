/**
 * Complete Quiz DTOs
 * @fileoverview Request and response types for quiz completion endpoint
 */

import type { QuizSessionId } from '../domain/value-objects/Ids';

/**
 * Response for quiz completion
 * Contains final score and user progress updates
 */
export interface CompleteQuizResponse {
  /** ID of the completed quiz session */
  sessionId: QuizSessionId;
  /** Final score percentage (0-100) */
  finalScore: number;
  /** Progress update information */
  progressUpdate: {
    /** User's level before quiz completion */
    previousLevel: number;
    /** User's level after quiz completion */
    newLevel: number;
    /** Experience points gained from this quiz */
    experienceGained: number;
  };
  /** Timestamp when quiz was completed */
  completedAt: Date;
}

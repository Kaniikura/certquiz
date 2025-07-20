/**
 * Start quiz DTOs
 * @fileoverview Request and response types for quiz session creation
 */

import type { QuestionId, QuizSessionId } from '../domain/value-objects/Ids';
import type { QuizConfigDTO } from '../domain/value-objects/QuizConfig';

/**
 * Request to start a new quiz session
 */
export interface StartQuizRequest {
  /** Exam type (e.g., 'CCNA', 'CCNP', 'Security+') */
  examType: string;

  /** Category within exam type (optional) */
  category?: string;

  /** Number of questions to include in quiz */
  questionCount: number;

  /** Time limit in seconds (optional, uses fallback if not specified) */
  timeLimit?: number;

  /** Difficulty level (optional, defaults to 'MIXED') */
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'MIXED';

  /** Whether answers must be submitted in order (optional, defaults to false) */
  enforceSequentialAnswering?: boolean;

  /** Whether all questions must be answered to complete (optional, defaults to false) */
  requireAllAnswers?: boolean;

  /** Whether to auto-complete when all answered (optional, defaults to true) */
  autoCompleteWhenAllAnswered?: boolean;

  /** Fallback time limit for sessions without explicit limit (optional) */
  fallbackLimitSeconds?: number;
}

/**
 * Response after successfully starting a quiz session
 */
export interface StartQuizResponse {
  /** Created quiz session ID */
  sessionId: QuizSessionId;

  /** Applied quiz configuration */
  config: QuizConfigDTO;

  /** Ordered list of question IDs for this session */
  questionIds: QuestionId[];

  /** Session start timestamp */
  startedAt: Date;

  /** Session expiration timestamp (null if no time limit) */
  expiresAt: Date | null;

  /** Current session state (should be 'IN_PROGRESS') */
  state: string;

  /** Current question index (starts at 0) */
  currentQuestionIndex: number;

  /** Total number of questions */
  totalQuestions: number;
}

/**
 * Question selection parameters for question service
 */
export interface QuestionSelectionParams {
  examType: string;
  category?: string;
  questionCount: number;
  difficulty?: string;
}

/**
 * Submit answer DTOs
 * @fileoverview Request and response types for submitting quiz answers
 */

import type { OptionId, QuestionId, QuizSessionId } from '../domain/value-objects/Ids';
import type { QuizState } from '../domain/value-objects/QuizState';

/**
 * Request to submit an answer to a question
 */
export interface SubmitAnswerRequest {
  /** ID of the question being answered */
  questionId: string;
  /** Array of selected option IDs */
  selectedOptionIds: string[];
}

/**
 * Response after submitting an answer
 */
export interface SubmitAnswerResponse {
  /** Updated session ID */
  sessionId: QuizSessionId;
  /** ID of the answered question */
  questionId: QuestionId;
  /** Selected option IDs */
  selectedOptionIds: OptionId[];
  /** Timestamp when answer was submitted */
  submittedAt: Date;
  /** Current quiz state after submission */
  state: QuizState;
  /** Whether quiz was auto-completed after this answer */
  autoCompleted: boolean;
  /** Current question index (0-based) */
  currentQuestionIndex: number;
  /** Total number of questions */
  totalQuestions: number;
  /** Number of questions answered so far */
  questionsAnswered: number;
  /**
   * Progress update information (only present when auto-completed and the progress update is available;
   * absent if auto-completion occurs but the progress update fails or is unavailable)
   */
  progressUpdate?: {
    /** Final score percentage (0-100) */
    finalScore: number;
    /** User's level before quiz completion */
    previousLevel: number;
    /** User's level after quiz completion */
    newLevel: number;
    /** Experience points gained from this quiz */
    experienceGained: number;
  };
}

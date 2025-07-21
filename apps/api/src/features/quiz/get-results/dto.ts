/**
 * Get results DTOs
 * @fileoverview Request and response types for getting quiz results
 */

import type { OptionId, QuestionId, QuizSessionId } from '../domain/value-objects/Ids';
import type { QuizState } from '../domain/value-objects/QuizState';

/**
 * Request to get quiz results
 * No body parameters - session ID is from URL parameter
 */
export type GetResultsRequest = Record<string, never>;

/**
 * Individual answer result with scoring
 */
export interface AnswerResult {
  /** Question ID */
  questionId: QuestionId;
  /** User's selected option IDs */
  selectedOptionIds: OptionId[];
  /** Correct option IDs for this question */
  correctOptionIds: OptionId[];
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** When the answer was submitted */
  submittedAt: Date;
  /** Question text for display */
  questionText: string;
  /** Option details for display */
  options: AnswerOption[];
}

/**
 * Option detail for results display
 */
export interface AnswerOption {
  /** Option ID */
  id: OptionId;
  /** Option text */
  text: string;
  /** Whether this option is correct */
  isCorrect: boolean;
  /** Whether user selected this option */
  wasSelected: boolean;
}

/**
 * Quiz score summary
 */
export interface ScoreSummary {
  /** Number of correct answers */
  correctAnswers: number;
  /** Total number of questions */
  totalQuestions: number;
  /** Percentage score (0-100) */
  percentage: number;
  /** Whether the quiz was passed (if passing criteria defined) */
  passed: boolean | null;
  /** Passing percentage threshold (if defined) */
  passingPercentage: number | null;
}

/**
 * Response with complete quiz results
 */
export interface GetResultsResponse {
  /** Quiz session information */
  sessionId: QuizSessionId;
  /** Current state of the quiz */
  state: QuizState;
  /** When the quiz was started */
  startedAt: Date;
  /** When the quiz was completed (if completed) */
  completedAt: Date | null;
  /** Quiz configuration details */
  config: {
    examType: string;
    category?: string;
    questionCount: number;
    timeLimit: number | null;
    difficulty?: string;
  };
  /** Overall score summary */
  score: ScoreSummary;
  /** Individual answer results */
  answers: AnswerResult[];
  /** Whether results can be viewed (quiz must be completed) */
  canViewResults: boolean;
}

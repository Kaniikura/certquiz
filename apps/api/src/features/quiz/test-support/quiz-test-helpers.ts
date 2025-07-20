/**
 * Test helper utilities for quiz feature
 * @fileoverview Common test setup and mock creation utilities
 */

import { TestClock, testIds } from '@api/test-support';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { QuizSession } from '../domain/aggregates/QuizSession';
import type { IQuizRepository } from '../domain/repositories/IQuizRepository';
import type { OptionId, QuestionId, QuizSessionId, UserId } from '../domain/value-objects/Ids';
import { QuizConfig } from '../domain/value-objects/QuizConfig';
import type {
  IQuestionDetailsService,
  QuestionDetails,
} from '../get-results/QuestionDetailsService';
import type { IQuestionService as StartQuizQuestionService } from '../start-quiz/QuestionService';
import type { IQuestionService as SubmitAnswerQuestionService } from '../submit-answer/QuestionService';

/**
 * Mock quiz repository with all required methods
 */
export interface MockQuizRepository {
  findById: Mock<IQuizRepository['findById']>;
  save: Mock<IQuizRepository['save']>;
  findExpiredSessions: Mock<IQuizRepository['findExpiredSessions']>;
  findActiveByUser: Mock<IQuizRepository['findActiveByUser']>;
}

/**
 * Creates a mock quiz repository
 */
export function createMockQuizRepository(): MockQuizRepository {
  return {
    findById: vi.fn(),
    save: vi.fn(),
    findExpiredSessions: vi.fn(),
    findActiveByUser: vi.fn(),
  };
}

/**
 * Creates a mock question service for start-quiz
 */
export function createMockStartQuizQuestionService(): {
  getQuestionsForQuiz: Mock<StartQuizQuestionService['getQuestionsForQuiz']>;
} {
  return {
    getQuestionsForQuiz: vi.fn(),
  };
}

/**
 * Creates a mock question service for submit-answer
 */
export function createMockSubmitAnswerQuestionService(): {
  getQuestionReference: Mock<SubmitAnswerQuestionService['getQuestionReference']>;
} {
  return {
    getQuestionReference: vi.fn(),
  };
}

/**
 * Creates a mock question details service
 */
export function createMockQuestionDetailsService(): {
  getQuestionDetails: Mock<IQuestionDetailsService['getQuestionDetails']>;
  getMultipleQuestionDetails: Mock<IQuestionDetailsService['getMultipleQuestionDetails']>;
} {
  return {
    getQuestionDetails: vi.fn(),
    getMultipleQuestionDetails: vi.fn(),
  };
}

/**
 * Common test context for quiz tests
 */
export interface QuizTestContext {
  clock: TestClock;
  userId: UserId;
  sessionId: QuizSessionId;
  questionIds: QuestionId[];
  optionIds: OptionId[];
  mockQuizRepository: MockQuizRepository;
}

/**
 * Creates a standard test context with common test data
 */
export function createQuizTestContext(options?: {
  baseDate?: Date;
  questionCount?: number;
  optionCount?: number;
  idPrefix?: string;
}): QuizTestContext {
  const {
    baseDate = new Date('2025-01-20T10:00:00Z'),
    questionCount = 3,
    optionCount = 4,
    idPrefix = 'test',
  } = options || {};

  return {
    clock: new TestClock(baseDate),
    userId: testIds.userId(),
    sessionId: testIds.quizSessionId(),
    questionIds: testIds.questionIds(questionCount, `${idPrefix}-q`),
    optionIds: testIds.optionIds(optionCount, `${idPrefix}-opt`),
    mockQuizRepository: createMockQuizRepository(),
  };
}

/**
 * Creates question details for testing
 */
export function createTestQuestionDetails(
  questionId: QuestionId,
  optionIds: OptionId[],
  options?: {
    correctOptionIndex?: number;
    questionText?: string;
  }
): QuestionDetails {
  const { correctOptionIndex = 0, questionText = `Question ${questionId}: Sample question text` } =
    options || {};

  return {
    id: questionId,
    text: questionText,
    options: optionIds.map((id, index) => ({
      id,
      text: `Option ${String.fromCharCode(65 + index)}${index === correctOptionIndex ? ' (Correct)' : ''}`,
      isCorrect: index === correctOptionIndex,
    })),
    correctOptionIds: [optionIds[correctOptionIndex]],
  };
}

/**
 * Creates a map of question details for multiple questions
 */
export function createTestQuestionDetailsMap(
  questionIds: QuestionId[],
  optionIds: OptionId[]
): Map<QuestionId, QuestionDetails> {
  const map = new Map<QuestionId, QuestionDetails>();

  questionIds.forEach((questionId, index) => {
    const details = createTestQuestionDetails(questionId, optionIds, {
      questionText: `Question ${index + 1}: Sample question text`,
    });
    map.set(questionId, details);
  });

  return map;
}

/**
 * Helper to create a valid quiz config
 */
export function createTestQuizConfig(overrides?: Partial<Parameters<typeof QuizConfig.create>[0]>) {
  const defaultConfig = {
    examType: 'CCNA' as const,
    questionCount: 3,
    timeLimit: 1800,
    difficulty: 'INTERMEDIATE' as const,
  };

  const configResult = QuizConfig.create({
    ...defaultConfig,
    ...overrides,
  });

  if (!configResult.success) {
    throw new Error(`Failed to create test quiz config: ${configResult.error.message}`);
  }

  return configResult.data;
}

/**
 * Setup mock repository to return a quiz session
 */
export function setupMockRepositoryWithSession(
  mockRepository: MockQuizRepository,
  session: QuizSession
): void {
  mockRepository.findById.mockResolvedValue(session);
  mockRepository.save.mockResolvedValue(undefined);
}

/**
 * Setup mock repository for no active session scenario
 */
export function setupMockRepositoryNoActiveSession(mockRepository: MockQuizRepository): void {
  mockRepository.findActiveByUser.mockResolvedValue(null);
  mockRepository.save.mockResolvedValue(undefined);
}

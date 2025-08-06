/**
 * Unit tests for DrizzleQuestionDetailsService
 * @fileoverview Tests for question details fetching service
 */

import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { beforeEach, describe, expect, it } from 'vitest';
import { OptionId, QuestionId } from '../../domain/value-objects/Ids';
import { DrizzleQuestionDetailsService } from './DrizzleQuestionDetailsService';

// Mock logger implementation
class MockLogger implements LoggerPort {
  public debugMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public errorMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public warnMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.debugMessages.push({ message, meta });
  }

  info(_message: string, _meta?: Record<string, unknown>): void {
    // Not used in these tests
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.warnMessages.push({ message, meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.errorMessages.push({ message, meta });
  }
}

// Type definitions for mock data
interface DatabaseQuestion {
  questionId: string;
  currentVersion: number;
}

interface DatabaseQuestionVersion {
  questionText: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
}

// Mock transaction context
class MockTransactionContext {
  private questions: Map<string, DatabaseQuestion>;
  private questionVersions: Map<string, DatabaseQuestionVersion>;
  private singleQueryId: string | null = null;
  private multiQueryIds: string[] = [];

  constructor() {
    this.questions = new Map();
    this.questionVersions = new Map();
  }

  // Test helper methods
  addQuestion(
    questionId: string,
    version: number,
    questionText: string,
    options: Array<{ id: string; text: string; isCorrect: boolean }>
  ) {
    this.questions.set(questionId, { questionId, currentVersion: version });
    this.questionVersions.set(`${questionId}_${version}`, { questionText, options });
  }

  setSingleQueryId(questionId: string) {
    this.singleQueryId = questionId;
  }

  setMultiQueryIds(questionIds: string[]) {
    this.multiQueryIds = questionIds;
  }

  private buildSingleQuestionResult(questionId: string) {
    const question = this.questions.get(questionId);
    if (!question) return [];

    const version = this.questionVersions.get(`${questionId}_${question.currentVersion}`);
    if (!version) return [];

    return [
      {
        questionId: question.questionId,
        version: question.currentVersion,
        questionText: version.questionText,
        options: version.options,
      },
    ];
  }

  private buildMultipleQuestionResults(questionIds: string[]) {
    return questionIds
      .map((id) => {
        const question = this.questions.get(id);
        if (!question) return null;

        const version = this.questionVersions.get(`${id}_${question.currentVersion}`);
        if (!version) return null;

        return {
          questionId: question.questionId,
          version: question.currentVersion,
          questionText: version.questionText,
          options: version.options,
        };
      })
      .filter((result): result is NonNullable<typeof result> => result !== null);
  }

  private extractQuestionId(_condition: unknown): string | null {
    // For testing, return the pre-set single query ID
    return this.singleQueryId;
  }

  private extractQuestionIds(_condition: unknown): string[] {
    // For testing, return the pre-set multi query IDs
    return this.multiQueryIds;
  }

  select(_columns: unknown) {
    return {
      from: (_table: unknown) => ({
        innerJoin: (_joinTable: unknown, _condition: unknown) => ({
          where: (condition: unknown) => {
            // Check if it's a single question query
            const questionId = this.extractQuestionId(condition);
            if (questionId) {
              const results = this.buildSingleQuestionResult(questionId);
              // Single query case - return object with limit method
              return {
                limit: (_n: number) => results,
              };
            }

            // Handle multiple question IDs
            const questionIds = this.extractQuestionIds(condition);
            const results = this.buildMultipleQuestionResults(questionIds);
            // Multiple query case - return results directly
            return results;
          },
        }),
      }),
    };
  }
}

describe('DrizzleQuestionDetailsService', () => {
  let mockTrx: MockTransactionContext;
  let mockLogger: MockLogger;
  let service: DrizzleQuestionDetailsService;

  beforeEach(() => {
    mockTrx = new MockTransactionContext();
    mockLogger = new MockLogger();
    service = new DrizzleQuestionDetailsService(mockTrx as never, mockLogger);
  });

  describe('getQuestionDetails', () => {
    it('should return null when question not found', async () => {
      const questionId = QuestionId.generate();
      mockTrx.setSingleQueryId(questionId.toString());

      const result = await service.getQuestionDetails(questionId);

      expect(result).toBeNull();
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'Question not found',
          meta: { questionId },
        })
      );
    });

    it('should return question details when found', async () => {
      const questionId = QuestionId.generate();
      const optionId1 = OptionId.generate();
      const optionId2 = OptionId.generate();

      // Add test data
      mockTrx.addQuestion(questionId.toString(), 1, 'What is 2 + 2?', [
        { id: optionId1.toString(), text: '3', isCorrect: false },
        { id: optionId2.toString(), text: '4', isCorrect: true },
      ]);
      mockTrx.setSingleQueryId(questionId.toString());

      const result = await service.getQuestionDetails(questionId);

      expect(result).toEqual({
        id: questionId,
        text: 'What is 2 + 2?',
        options: [
          { id: optionId1.toString(), text: '3', isCorrect: false },
          { id: optionId2.toString(), text: '4', isCorrect: true },
        ],
        correctOptionIds: [optionId2],
      });
    });

    it('should handle multiple correct answers', async () => {
      const questionId = QuestionId.generate();
      const optionId1 = OptionId.generate();
      const optionId2 = OptionId.generate();
      const optionId3 = OptionId.generate();

      // Add test data with multiple correct answers
      mockTrx.addQuestion(questionId.toString(), 1, 'Select all even numbers', [
        { id: optionId1.toString(), text: '1', isCorrect: false },
        { id: optionId2.toString(), text: '2', isCorrect: true },
        { id: optionId3.toString(), text: '4', isCorrect: true },
      ]);
      mockTrx.setSingleQueryId(questionId.toString());

      const result = await service.getQuestionDetails(questionId);

      expect(result?.correctOptionIds).toHaveLength(2);
      expect(result?.correctOptionIds).toContain(optionId2);
      expect(result?.correctOptionIds).toContain(optionId3);
    });

    it('should log and re-throw errors', async () => {
      const questionId = QuestionId.generate();
      const error = new Error('Database connection failed');

      // Mock error
      service = new DrizzleQuestionDetailsService(
        {
          select: () => {
            throw error;
          },
        } as never,
        mockLogger
      );

      await expect(service.getQuestionDetails(questionId)).rejects.toThrow(error);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to fetch question details',
          meta: expect.objectContaining({
            questionId,
          }),
        })
      );
    });
  });

  describe('getMultipleQuestionDetails', () => {
    it('should return empty map for empty input', async () => {
      const result = await service.getMultipleQuestionDetails([]);

      expect(result.size).toBe(0);
    });

    it('should return map of question details', async () => {
      const questionId1 = QuestionId.generate();
      const questionId2 = QuestionId.generate();
      const optionId1 = OptionId.generate();
      const optionId2 = OptionId.generate();

      // Add test data
      mockTrx.addQuestion(questionId1.toString(), 1, 'Question 1', [
        { id: optionId1.toString(), text: 'Option 1', isCorrect: true },
      ]);
      mockTrx.addQuestion(questionId2.toString(), 1, 'Question 2', [
        { id: optionId2.toString(), text: 'Option 2', isCorrect: true },
      ]);
      mockTrx.setMultiQueryIds([questionId1.toString(), questionId2.toString()]);

      const result = await service.getMultipleQuestionDetails([questionId1, questionId2]);

      expect(result.size).toBe(2);
      expect(result.get(questionId1)).toEqual({
        id: questionId1,
        text: 'Question 1',
        options: [{ id: optionId1.toString(), text: 'Option 1', isCorrect: true }],
        correctOptionIds: [optionId1],
      });
      expect(result.get(questionId2)).toEqual({
        id: questionId2,
        text: 'Question 2',
        options: [{ id: optionId2.toString(), text: 'Option 2', isCorrect: true }],
        correctOptionIds: [optionId2],
      });
    });

    it('should log warning for missing questions', async () => {
      const questionId1 = QuestionId.generate();
      const questionId2 = QuestionId.generate();

      // Only add one question
      mockTrx.addQuestion(questionId1.toString(), 1, 'Question 1', [
        { id: OptionId.generate().toString(), text: 'Option 1', isCorrect: true },
      ]);
      mockTrx.setMultiQueryIds([questionId1.toString()]); // Only return one

      const result = await service.getMultipleQuestionDetails([questionId1, questionId2]);

      expect(result.size).toBe(1);
      expect(mockLogger.warnMessages).toContainEqual(
        expect.objectContaining({
          message: 'Some questions not found',
          meta: expect.objectContaining({
            requested: 2,
            found: 1,
            missing: 1,
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const questionIds = [QuestionId.generate(), QuestionId.generate()];
      const error = new Error('Query timeout');

      // Mock error
      service = new DrizzleQuestionDetailsService(
        {
          select: () => {
            throw error;
          },
        } as never,
        mockLogger
      );

      await expect(service.getMultipleQuestionDetails(questionIds)).rejects.toThrow(error);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to fetch multiple question details',
          meta: expect.objectContaining({
            count: 2,
          }),
        })
      );
    });
  });
});

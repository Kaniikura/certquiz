/**
 * Unit tests for DrizzleQuestionRepository using mocks
 * @fileoverview Tests question repository operations with sophisticated mocked database connections
 */

import { QuestionId } from '@api/features/quiz/domain';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { beforeEach, describe, expect, it } from 'vitest';
import { Question, QuestionStatus } from '../../domain/entities/Question';
import type {
  QuestionFilters,
  QuestionPagination,
} from '../../domain/repositories/IQuestionRepository';
import { QuestionOption } from '../../domain/value-objects/QuestionOption';
import { QuestionOptions } from '../../domain/value-objects/QuestionOptions';
import {
  InvalidQuestionDataError,
  QuestionNotFoundError,
  QuestionRepositoryConfigurationError,
  QuestionRepositoryError,
  QuestionVersionConflictError,
} from '../../shared/errors';
import { DrizzleQuestionRepository } from './DrizzleQuestionRepository';

// Mock types for testing
interface MockQuestionRow {
  questionId: string;
  currentVersion: number;
  createdById: string;
  isPremium: boolean;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

interface MockQuestionVersionRow {
  questionId: string;
  version: number;
  questionText: string;
  questionType: 'single' | 'multiple';
  explanation: string;
  detailedExplanation: string | null;
  options: unknown[];
  examTypes: string[];
  categories: string[];
  difficulty: string;
  tags: string[];
  images: string[];
  createdAt: Date;
}

interface MockJoinedQuestionRow extends MockQuestionRow {
  // Version fields from join (with master prefix for disambiguation)
  master: MockQuestionRow;
  version: MockQuestionVersionRow;
}

// Mock logger implementation
class MockLogger implements LoggerPort {
  public debugMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public infoMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public warnMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public errorMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.debugMessages.push({ message, meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.infoMessages.push({ message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.warnMessages.push({ message, meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.errorMessages.push({ message, meta });
  }
}

// Type alias for test repository
type TestRepository = DrizzleQuestionRepository;

// Mock database connection with sophisticated context-aware operations
// Uses type assertions for test mocking while maintaining business logic type safety
class MockDatabaseConnection {
  private questions: MockQuestionRow[] = [];
  private questionVersions: MockQuestionVersionRow[] = [];
  private insertShouldFail = false;
  private insertFailureError: Error | null = null;
  private selectShouldFail = false;
  private selectFailureError: Error | null = null;
  private updateShouldFail = false;
  private updateFailureError: Error | null = null;
  private currentQueryContext: {
    type?: 'findById' | 'findWithDetails' | 'findQuestions' | 'getStats' | 'select' | 'count';
    questionId?: string;
    includePremium?: boolean;
    filters?: QuestionFilters;
    pagination?: QuestionPagination;
    operation?: string;
  } = {};

  // Mock select operations with context-aware filtering
  select(fields?: unknown) {
    if (this.selectShouldFail && this.selectFailureError) {
      throw this.selectFailureError;
    }

    // Check query type by looking at the selected fields
    const isStatsQuery = this.isStatsQuery(fields);
    const isCountQuery = this.isCountQuery(fields);

    return {
      from: (table: unknown) => {
        if (this.isQuestionTable(table)) {
          return {
            innerJoin: (_versionTable: unknown, _condition: unknown) => ({
              where: (_condition: unknown) => {
                if (isStatsQuery) {
                  // For stats queries, return version data with examTypes and difficulty
                  return this.getStatsVersionRows();
                }
                if (isCountQuery) {
                  // For count queries within joins, return count based on context
                  return this.getFilteredCountResults();
                }
                return {
                  limit: (n: number) => {
                    return this.getJoinQueryResults().slice(0, n);
                  },
                  orderBy: (_field: unknown) => ({
                    limit: (n: number) => ({
                      offset: (offset: number) => {
                        return this.getJoinQueryResults().slice(offset, offset + n);
                      },
                    }),
                  }),
                };
              },
            }),
            where: (_condition: unknown) => {
              if (isCountQuery) {
                // For simple count queries on question table (stats method)
                return this.getStatsCountResults();
              }
              return {
                limit: (n: number) => {
                  if (this.currentQueryContext.type === 'getStats') {
                    return this.getStatsResults();
                  }
                  return this.getQuestionResults().slice(0, n);
                },
              };
            },
          };
        }
        return {
          where: () => ({
            limit: () => [],
            innerJoin: () => ({ where: () => ({ limit: () => [] }) }),
          }),
        };
      },
    };
  }

  // Mock insert operations
  insert(table: unknown) {
    return {
      values: (data: unknown) => {
        if (this.insertShouldFail && this.insertFailureError) {
          throw this.insertFailureError;
        }

        if (this.isQuestionTable(table)) {
          const questionRow = data as MockQuestionRow;
          this.questions.push(questionRow);
        } else if (this.isQuestionVersionTable(table)) {
          const versionRow = data as MockQuestionVersionRow;
          this.questionVersions.push(versionRow);
        }

        return Promise.resolve();
      },
    };
  }

  // Mock update operations
  update(table: unknown) {
    return {
      set: (data: unknown) => ({
        where: (_condition: unknown) => {
          if (this.updateShouldFail && this.updateFailureError) {
            throw this.updateFailureError;
          }

          if (this.isQuestionTable(table)) {
            const updateData = data as Partial<MockQuestionRow>;
            const questionIndex = this.questions.findIndex(
              (q) => q.questionId === this.currentQueryContext.questionId
            );
            if (questionIndex >= 0) {
              this.questions[questionIndex] = { ...this.questions[questionIndex], ...updateData };
            }
          }

          return Promise.resolve();
        },
      }),
    };
  }

  // Mock transaction support
  transaction<T>(fn: (tx: MockDatabaseConnection) => Promise<T>): Promise<T> {
    const tx = new MockDatabaseConnection();
    tx.questions = [...this.questions];
    tx.questionVersions = [...this.questionVersions];
    tx.insertShouldFail = this.insertShouldFail;
    tx.insertFailureError = this.insertFailureError;
    tx.updateShouldFail = this.updateShouldFail;
    tx.updateFailureError = this.updateFailureError;
    tx.currentQueryContext = { ...this.currentQueryContext };
    return fn(tx);
  }

  // Mock Queryable methods to satisfy interface
  delete(_table: unknown): { where: () => Promise<void> } {
    return { where: () => Promise.resolve() };
  }

  execute(_query: unknown): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  query(_query: unknown, _params?: unknown[]): Promise<unknown[]> {
    return Promise.resolve([]);
  }

  // Helper methods for testing
  addQuestion(question: MockQuestionRow): void {
    this.questions.push(question);
  }

  addQuestionVersion(version: MockQuestionVersionRow): void {
    this.questionVersions.push(version);
  }

  addCompleteQuestion(questionData: MockQuestionRow, versionData: MockQuestionVersionRow): void {
    this.questions.push(questionData);
    this.questionVersions.push(versionData);
  }

  clearAll(): void {
    this.questions = [];
    this.questionVersions = [];
  }

  simulateInsertFailure(error: Error): void {
    this.insertShouldFail = true;
    this.insertFailureError = error;
  }

  simulateSelectFailure(error: Error): void {
    this.selectShouldFail = true;
    this.selectFailureError = error;
  }

  simulateUpdateFailure(error: Error): void {
    this.updateShouldFail = true;
    this.updateFailureError = error;
  }

  resetFailures(): void {
    this.insertShouldFail = false;
    this.insertFailureError = null;
    this.selectShouldFail = false;
    this.selectFailureError = null;
    this.updateShouldFail = false;
    this.updateFailureError = null;
  }

  // Methods to set query context for different scenarios
  setFindByIdContext(questionId: string, includePremium = false): void {
    this.currentQueryContext = { type: 'findById', questionId, includePremium };
  }

  setFindWithDetailsContext(questionId: string): void {
    this.currentQueryContext = { type: 'findWithDetails', questionId };
  }

  setFindQuestionsContext(filters: QuestionFilters, pagination: QuestionPagination): void {
    this.currentQueryContext = { type: 'findQuestions', filters, pagination };
  }

  setGetStatsContext(): void {
    this.currentQueryContext = { type: 'getStats' };
  }

  setSelectContext(questionId?: string, operation?: string): void {
    this.currentQueryContext = { type: 'select', questionId, operation };
  }

  clearQueryContext(): void {
    this.currentQueryContext = {};
    this.statsCallCount = 0;
  }

  private getJoinQueryResults(): MockJoinedQuestionRow[] {
    return this.questions
      .map((question) => this.createJoinedRowIfValid(question))
      .filter((row): row is MockJoinedQuestionRow => row !== null);
  }

  private createJoinedRowIfValid(question: MockQuestionRow): MockJoinedQuestionRow | null {
    const version = this.findQuestionVersion(question);
    if (!version) return null;

    const joinedRow: MockJoinedQuestionRow = {
      ...question,
      master: question,
      version,
    };

    return this.applyQueryFilters(question, version, joinedRow);
  }

  private findQuestionVersion(question: MockQuestionRow): MockQuestionVersionRow | undefined {
    return this.questionVersions.find(
      (v) =>
        v.questionId === question.questionId &&
        (this.currentQueryContext.operation === 'update'
          ? true // For updates, we need the current version for version checking
          : v.version === question.currentVersion)
    );
  }

  private applyQueryFilters(
    question: MockQuestionRow,
    version: MockQuestionVersionRow,
    joinedRow: MockJoinedQuestionRow
  ): MockJoinedQuestionRow | null {
    switch (this.currentQueryContext.type) {
      case 'findById':
      case 'findWithDetails':
        return this.applyIdBasedFilters(question, joinedRow);
      case 'findQuestions':
        return this.applySearchFilters(question, version, joinedRow);
      default:
        return joinedRow;
    }
  }

  private applyIdBasedFilters(
    question: MockQuestionRow,
    joinedRow: MockJoinedQuestionRow
  ): MockJoinedQuestionRow | null {
    if (question.questionId !== this.currentQueryContext.questionId) return null;

    // Apply premium filtering for findById
    if (
      this.currentQueryContext.type === 'findById' &&
      !this.currentQueryContext.includePremium &&
      question.isPremium
    ) {
      return null;
    }
    return joinedRow;
  }

  private applySearchFilters(
    question: MockQuestionRow,
    version: MockQuestionVersionRow,
    joinedRow: MockJoinedQuestionRow
  ): MockJoinedQuestionRow | null {
    if (!this.currentQueryContext.filters) return joinedRow;

    const filters = this.currentQueryContext.filters;

    if (!this.passesBasicFilters(question, filters)) return null;
    if (!this.passesAdvancedFilters(version, filters)) return null;

    return joinedRow;
  }

  private passesBasicFilters(question: MockQuestionRow, filters: QuestionFilters): boolean {
    // Active only filter
    if (filters.activeOnly && question.status !== 'active') return false;

    // Premium filter
    if (!filters.includePremium && question.isPremium) return false;

    return true;
  }

  private passesAdvancedFilters(
    version: MockQuestionVersionRow,
    filters: QuestionFilters
  ): boolean {
    // Exam types filter
    if (
      filters.examTypes &&
      filters.examTypes.length > 0 &&
      !filters.examTypes.some((type: string) => version.examTypes.includes(type))
    ) {
      return false;
    }

    // Categories filter
    if (
      filters.categories &&
      filters.categories.length > 0 &&
      !filters.categories.some((cat: string) => version.categories.includes(cat))
    ) {
      return false;
    }

    // Difficulty filter
    if (filters.difficulty && version.difficulty !== filters.difficulty) return false;

    // Search query filter
    if (
      filters.searchQuery &&
      !version.questionText.toLowerCase().includes(filters.searchQuery.toLowerCase())
    ) {
      return false;
    }

    return true;
  }

  private getQuestionResults(): MockQuestionRow[] {
    if (this.currentQueryContext.type === 'select' && this.currentQueryContext.questionId) {
      return this.questions.filter((q) => q.questionId === this.currentQueryContext.questionId);
    }
    return this.questions;
  }

  private getStatsResults(): Array<{ count: number }> {
    if (this.currentQueryContext.type === 'getStats') {
      const activeQuestions = this.questions.filter((q) => q.status === 'active');
      return [{ count: activeQuestions.length }];
    }
    return [{ count: this.questions.length }];
  }

  private getStatsVersionRows(): Array<{ examTypes: string[]; difficulty: string }> {
    const activeQuestions = this.questions.filter((q) => q.status === 'active');
    return activeQuestions.map((question) => {
      const version = this.questionVersions.find(
        (v) => v.questionId === question.questionId && v.version === question.currentVersion
      );
      return {
        examTypes: version?.examTypes || [],
        difficulty: version?.difficulty || 'Beginner',
      };
    });
  }

  private getFilteredCountResults(): Array<{ count: number }> {
    // Apply the same filtering logic as getJoinQueryResults but return count
    const filtered = this.getJoinQueryResults();
    return [{ count: filtered.length }];
  }

  private statsCallCount = 0;

  private getStatsCountResults(): Array<{ count: number }> {
    // For stats queries, handle different calls differently
    this.statsCallCount++;

    const activeQuestions = this.questions.filter((q) => q.status === 'active');

    // Track call count to differentiate between total and premium queries

    // First call: total questions (active)
    // Second call: premium questions (active AND premium)
    if (this.statsCallCount === 1) {
      return [{ count: activeQuestions.length }];
    } else if (this.statsCallCount === 2) {
      const premiumQuestions = activeQuestions.filter((q) => q.isPremium);
      return [{ count: premiumQuestions.length }];
    }

    return [{ count: activeQuestions.length }];
  }

  private isStatsQuery(fields: unknown): boolean {
    if (typeof fields !== 'object' || fields === null) return false;
    const keys = Object.keys(fields as Record<string, unknown>);
    return keys.includes('examTypes') && keys.includes('difficulty');
  }

  private isCountQuery(fields: unknown): boolean {
    if (typeof fields !== 'object' || fields === null) return false;
    const keys = Object.keys(fields as Record<string, unknown>);
    return keys.includes('count');
  }

  private isQuestionTable(table: unknown): boolean {
    if (typeof table !== 'object' || table === null) return false;
    const keys = Object.keys(table as Record<string, unknown>);
    return (
      keys.includes('questionId') && keys.includes('currentVersion') && keys.includes('status')
    );
  }

  private isQuestionVersionTable(table: unknown): boolean {
    if (typeof table !== 'object' || table === null) return false;
    const keys = Object.keys(table as Record<string, unknown>);
    return (
      keys.includes('questionId') &&
      keys.includes('version') &&
      keys.includes('questionText') &&
      keys.includes('questionType')
    );
  }
}

describe('DrizzleQuestionRepository (Unit Tests)', () => {
  let mockConn: MockDatabaseConnection;
  let mockLogger: MockLogger;
  let repository: TestRepository;

  // Helper to create test question options
  function createTestOptions() {
    const option1Result = QuestionOption.create({
      id: '550e8400-e29b-41d4-a716-446655440001',
      text: 'Option A',
      isCorrect: true,
    });
    const option2Result = QuestionOption.create({
      id: '550e8400-e29b-41d4-a716-446655440002',
      text: 'Option B',
      isCorrect: false,
    });

    if (!option1Result.success || !option2Result.success) {
      throw new Error('Failed to create test options');
    }

    const optionsResult = QuestionOptions.create([option1Result.data, option2Result.data]);
    if (!optionsResult.success) {
      throw new Error('Failed to create test options collection');
    }

    return optionsResult.data;
  }

  // Helper to create test question
  function createTestQuestion(overrides: Partial<Parameters<typeof Question.create>[0]> = {}) {
    const options = createTestOptions();

    const questionResult = Question.create({
      id: QuestionId.of('test-question-1'),
      version: 1,
      questionText: 'What is networking?',
      questionType: 'multiple_choice',
      explanation: 'Basic networking concept',
      detailedExplanation: 'Detailed explanation here',
      options,
      examTypes: ['CCNA'],
      categories: ['Networking'],
      difficulty: 'Beginner',
      tags: ['network', 'basic'],
      images: [],
      isPremium: false,
      status: QuestionStatus.ACTIVE,
      createdById: '550e8400-e29b-41d4-a716-446655440000',
      createdAt: new Date('2025-01-01T12:00:00Z'),
      updatedAt: new Date('2025-01-01T12:00:00Z'),
      ...overrides,
    });

    if (!questionResult.success) {
      throw new Error(`Failed to create test question: ${questionResult.error.message}`);
    }

    return questionResult.data;
  }

  beforeEach(() => {
    mockConn = new MockDatabaseConnection();
    mockLogger = new MockLogger();
    repository = new DrizzleQuestionRepository(mockConn as never, mockLogger);
    mockConn.clearQueryContext();
  });

  describe('constructor', () => {
    it('should throw error when database connection lacks transaction support', () => {
      const nonTransactionalConn = {
        select: mockConn.select.bind(mockConn),
        insert: mockConn.insert.bind(mockConn),
        update: mockConn.update.bind(mockConn),
        // No transaction method
      };

      expect(
        () => new DrizzleQuestionRepository(nonTransactionalConn as never, mockLogger)
      ).toThrow(QuestionRepositoryConfigurationError);
    });

    it('should validate transaction support on initialization', () => {
      expect(() => new DrizzleQuestionRepository(mockConn as never, mockLogger)).not.toThrow();
    });
  });

  describe('createQuestion', () => {
    it('should create question successfully with master and version records', async () => {
      const question = createTestQuestion();

      const result = await repository.createQuestion(question);

      expect(result).toBe(question);
      expect(mockLogger.infoMessages).toContainEqual(
        expect.objectContaining({
          message: 'Creating new question',
          meta: expect.objectContaining({
            questionId: question.id,
          }),
        })
      );
      expect(mockLogger.infoMessages).toContainEqual(
        expect.objectContaining({
          message: 'Question created successfully',
          meta: expect.objectContaining({
            questionId: question.id,
            version: question.version,
          }),
        })
      );
    });

    it('should handle database errors during creation', async () => {
      const question = createTestQuestion();
      const dbError = new Error('Database insert failed');

      mockConn.simulateInsertFailure(dbError);

      await expect(repository.createQuestion(question)).rejects.toThrow(QuestionRepositoryError);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to create question',
          meta: expect.objectContaining({
            questionId: question.id,
            error: expect.objectContaining({
              message: 'Database insert failed',
            }),
          }),
        })
      );
    });

    it('should create question with different types correctly', async () => {
      const option1 = QuestionOption.create({
        id: '550e8400-e29b-41d4-a716-446655440003',
        text: 'True',
        isCorrect: true,
      });
      const option2 = QuestionOption.create({
        id: '550e8400-e29b-41d4-a716-446655440004',
        text: 'False',
        isCorrect: false,
      });

      if (!option1.success || !option2.success) {
        throw new Error('Failed to create test options');
      }

      const trueFalseOptions = QuestionOptions.create([option1.data, option2.data]);

      if (!trueFalseOptions.success) {
        throw new Error('Failed to create options collection');
      }

      const trueFalseQuestion = createTestQuestion({
        id: QuestionId.of('true-false-question'),
        questionText: 'Is the sky blue?',
        questionType: 'true_false',
        options: trueFalseOptions.data,
      });

      const result = await repository.createQuestion(trueFalseQuestion);

      expect(result.questionType).toBe('true_false');
    });
  });

  describe('updateQuestion', () => {
    it('should update question successfully with optimistic locking', async () => {
      const questionId = 'test-question-1';

      // Add existing question with version 1
      mockConn.addCompleteQuestion(
        {
          questionId,
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId,
          version: 1,
          questionText: 'Original question',
          questionType: 'single',
          explanation: 'Original explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      const updatedQuestion = createTestQuestion({
        id: QuestionId.of(questionId),
        version: 2, // Incremented version
        questionText: 'Updated question text',
        updatedAt: new Date('2025-01-01T13:00:00Z'),
      });

      // Set context for version check
      mockConn.setSelectContext(questionId, 'update');

      const result = await repository.updateQuestion(updatedQuestion);

      expect(result).toBe(updatedQuestion);
      expect(mockLogger.infoMessages).toContainEqual(
        expect.objectContaining({
          message: 'Question updated successfully',
          meta: expect.objectContaining({
            questionId: updatedQuestion.id,
            version: updatedQuestion.version,
          }),
        })
      );
    });

    it('should throw QuestionNotFoundError when question does not exist', async () => {
      const question = createTestQuestion({
        id: QuestionId.of('nonexistent-question'),
        version: 2,
      });

      mockConn.setSelectContext('nonexistent-question', 'update');

      await expect(repository.updateQuestion(question)).rejects.toThrow(QuestionNotFoundError);
    });

    it('should throw QuestionVersionConflictError on version mismatch', async () => {
      const questionId = 'test-question-1';

      // Add existing question with version 2 (current)
      mockConn.addCompleteQuestion(
        {
          questionId,
          currentVersion: 2, // Current version is 2
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId,
          version: 2,
          questionText: 'Current question',
          questionType: 'single',
          explanation: 'Current explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      const question = createTestQuestion({
        id: QuestionId.of(questionId),
        version: 2, // Trying to update to version 2, but expects 1 as current
      });

      mockConn.setSelectContext(questionId, 'update');

      await expect(repository.updateQuestion(question)).rejects.toThrow(
        QuestionVersionConflictError
      );

      expect(mockLogger.warnMessages).toContainEqual(
        expect.objectContaining({
          message: 'Version conflict detected',
          meta: expect.objectContaining({
            questionId,
            expectedVersion: 1, // Expected previous version
            actualVersion: 2, // Actual current version
          }),
        })
      );
    });

    it('should handle database errors during update', async () => {
      const questionId = 'test-question-1';

      mockConn.addCompleteQuestion(
        {
          questionId,
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId,
          version: 1,
          questionText: 'Original question',
          questionType: 'single',
          explanation: 'Original explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      const question = createTestQuestion({
        id: QuestionId.of(questionId),
        version: 2,
      });

      mockConn.setSelectContext(questionId, 'update');

      const dbError = new Error('Database update failed');
      mockConn.simulateUpdateFailure(dbError);

      await expect(repository.updateQuestion(question)).rejects.toThrow(QuestionRepositoryError);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to update question',
          meta: expect.objectContaining({
            questionId: question.id,
            error: expect.objectContaining({
              message: 'Database update failed',
            }),
          }),
        })
      );
    });
  });

  describe('findQuestionWithDetails', () => {
    it('should return question with complete details when found', async () => {
      const questionId = QuestionId.of('test-question-1');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'What is networking?',
          questionType: 'single',
          explanation: 'Basic networking concept',
          detailedExplanation: 'Detailed explanation',
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: ['network'],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindWithDetailsContext(questionId.toString());

      const result = await repository.findQuestionWithDetails(questionId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(questionId.toString());
      expect(result?.questionText).toBe('What is networking?');
      expect(result?.version).toBe(1);
    });

    it('should return null when question not found', async () => {
      const questionId = QuestionId.of('nonexistent-question');

      mockConn.setFindWithDetailsContext(questionId.toString());

      const result = await repository.findQuestionWithDetails(questionId);

      expect(result).toBeNull();
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'Question not found',
          meta: expect.objectContaining({
            questionId,
          }),
        })
      );
    });

    it('should handle database errors during find', async () => {
      const questionId = QuestionId.of('test-question-1');
      const dbError = new Error('Database query failed');

      mockConn.simulateSelectFailure(dbError);

      await expect(repository.findQuestionWithDetails(questionId)).rejects.toThrow(
        QuestionRepositoryError
      );

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to find question with details',
          meta: expect.objectContaining({
            questionId,
            error: expect.objectContaining({
              message: 'Database query failed',
            }),
          }),
        })
      );
    });

    it('should handle invalid question data during reconstruction', async () => {
      const questionId = QuestionId.of('test-question-1');

      // Add question with invalid data that will fail Question.fromJSON
      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: '', // Invalid empty question text
          questionType: 'single',
          explanation: 'Basic networking concept',
          detailedExplanation: null,
          options: [], // Invalid empty options
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindWithDetailsContext(questionId.toString());

      await expect(repository.findQuestionWithDetails(questionId)).rejects.toThrow(
        InvalidQuestionDataError
      );
    });

    it('should correctly detect and map true/false questions', async () => {
      const questionId = QuestionId.of('true-false-question');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Is the sky blue?',
          questionType: 'single',
          explanation: 'Sky appears blue due to light scattering',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440003', text: 'True', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440004', text: 'False', isCorrect: false },
          ],
          examTypes: ['GENERAL'],
          categories: ['Science'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindWithDetailsContext(questionId.toString());

      const result = await repository.findQuestionWithDetails(questionId);

      expect(result).toBeDefined();
      expect(result?.questionType).toBe('true_false');
      expect(result?.questionText).toBe('Is the sky blue?');
    });
  });

  describe('findQuestionById', () => {
    it('should return question summary when found', async () => {
      const questionId = QuestionId.of('test-question-1');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'What is networking?',
          questionType: 'single',
          explanation: 'Basic networking concept',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: ['network'],
          images: ['image1.jpg'],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindByIdContext(questionId.toString(), false);

      const result = await repository.findQuestionById(questionId, false);

      expect(result).toBeDefined();
      expect(result?.questionId).toEqual(questionId);
      expect(result?.questionText).toBe('What is networking?');
      expect(result?.questionType).toBe('multiple_choice');
      expect(result?.optionCount).toBe(2);
      expect(result?.hasImages).toBe(true);
      expect(result?.isPremium).toBe(false);
    });

    it('should return null when premium question found but includePremium is false', async () => {
      const questionId = QuestionId.of('premium-question');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: true, // Premium question
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Premium question',
          questionType: 'single',
          explanation: 'Premium explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'advanced',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindByIdContext(questionId.toString(), false);

      const result = await repository.findQuestionById(questionId, false);

      expect(result).toBeNull();
    });

    it('should return premium question when includePremium is true', async () => {
      const questionId = QuestionId.of('premium-question');

      mockConn.addCompleteQuestion(
        {
          questionId: questionId.toString(),
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: true,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: questionId.toString(),
          version: 1,
          questionText: 'Premium question',
          questionType: 'single',
          explanation: 'Premium explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'advanced',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.setFindByIdContext(questionId.toString(), true);

      const result = await repository.findQuestionById(questionId, true);

      expect(result).toBeDefined();
      expect(result?.isPremium).toBe(true);
    });

    it('should handle database errors during findById', async () => {
      const questionId = QuestionId.of('test-question-1');
      const dbError = new Error('Database connection failed');

      mockConn.simulateSelectFailure(dbError);

      await expect(repository.findQuestionById(questionId)).rejects.toThrow(
        QuestionRepositoryError
      );

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to find question by ID',
          meta: expect.objectContaining({
            questionId,
            error: expect.objectContaining({
              message: 'Database connection failed',
            }),
          }),
        })
      );
    });
  });

  describe('findQuestions', () => {
    it('should return paginated questions with filters', async () => {
      // Add multiple questions
      mockConn.addCompleteQuestion(
        {
          questionId: 'question-1',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: 'question-1',
          version: 1,
          questionText: 'CCNA networking question',
          questionType: 'single',
          explanation: 'CCNA explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.addCompleteQuestion(
        {
          questionId: 'question-2',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: true,
          status: 'active',
          createdAt: new Date('2025-01-01T13:00:00Z'),
          updatedAt: new Date('2025-01-01T13:00:00Z'),
        },
        {
          questionId: 'question-2',
          version: 1,
          questionText: 'CCNP security question',
          questionType: 'multiple',
          explanation: 'CCNP explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: true },
          ],
          examTypes: ['CCNP'],
          categories: ['Security'],
          difficulty: 'intermediate',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T13:00:00Z'),
        }
      );

      const filters: QuestionFilters = {
        activeOnly: true,
        includePremium: false,
        examTypes: ['CCNA'],
        categories: undefined,
        difficulty: undefined,
        searchQuery: undefined,
      };

      const pagination: QuestionPagination = {
        limit: 10,
        offset: 0,
      };

      mockConn.setFindQuestionsContext(filters, pagination);

      const result = await repository.findQuestions(filters, pagination);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].questionText).toBe('CCNA networking question');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('should handle search query filtering', async () => {
      mockConn.addCompleteQuestion(
        {
          questionId: 'question-1',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: 'question-1',
          version: 1,
          questionText: 'What is the TCP/IP protocol stack?',
          questionType: 'single',
          explanation: 'TCP/IP explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      const filters: QuestionFilters = {
        activeOnly: true,
        includePremium: true,
        searchQuery: 'TCP/IP',
      };

      const pagination: QuestionPagination = {
        limit: 10,
        offset: 0,
      };

      mockConn.setFindQuestionsContext(filters, pagination);

      const result = await repository.findQuestions(filters, pagination);

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].questionText).toContain('TCP/IP');
    });

    it('should handle database errors during find', async () => {
      const filters: QuestionFilters = {
        activeOnly: true,
        includePremium: true,
      };

      const pagination: QuestionPagination = {
        limit: 10,
        offset: 0,
      };

      const dbError = new Error('Query execution failed');
      mockConn.simulateSelectFailure(dbError);

      await expect(repository.findQuestions(filters, pagination)).rejects.toThrow(
        QuestionRepositoryError
      );

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to find questions',
          meta: expect.objectContaining({
            filters,
            pagination,
            error: expect.objectContaining({
              message: 'Query execution failed',
            }),
          }),
        })
      );
    });
  });

  describe('getQuestionStats', () => {
    it('should return question statistics', async () => {
      // Add questions for stats testing
      mockConn.addCompleteQuestion(
        {
          questionId: 'question-1',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: false,
          status: 'active',
          createdAt: new Date('2025-01-01T12:00:00Z'),
          updatedAt: new Date('2025-01-01T12:00:00Z'),
        },
        {
          questionId: 'question-1',
          version: 1,
          questionText: 'CCNA question',
          questionType: 'single',
          explanation: 'CCNA explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: false },
          ],
          examTypes: ['CCNA'],
          categories: ['Networking'],
          difficulty: 'Beginner',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T12:00:00Z'),
        }
      );

      mockConn.addCompleteQuestion(
        {
          questionId: 'question-2',
          currentVersion: 1,
          createdById: '550e8400-e29b-41d4-a716-446655440000',
          isPremium: true,
          status: 'active',
          createdAt: new Date('2025-01-01T13:00:00Z'),
          updatedAt: new Date('2025-01-01T13:00:00Z'),
        },
        {
          questionId: 'question-2',
          version: 1,
          questionText: 'CCNP question',
          questionType: 'multiple',
          explanation: 'CCNP explanation',
          detailedExplanation: null,
          options: [
            { id: '550e8400-e29b-41d4-a716-446655440001', text: 'Option A', isCorrect: true },
            { id: '550e8400-e29b-41d4-a716-446655440002', text: 'Option B', isCorrect: true },
          ],
          examTypes: ['CCNP'],
          categories: ['Security'],
          difficulty: 'intermediate',
          tags: [],
          images: [],
          createdAt: new Date('2025-01-01T13:00:00Z'),
        }
      );

      mockConn.setGetStatsContext();

      const result = await repository.getQuestionStats();

      expect(result.totalQuestions).toBe(2);
      expect(result.premiumQuestions).toBe(1);
      expect(result.questionsByExamType).toEqual({
        CCNA: 1,
        CCNP: 1,
      });
      expect(result.questionsByDifficulty).toEqual({
        Beginner: 1,
        intermediate: 1,
      });
    });

    it('should handle database errors during stats retrieval', async () => {
      const dbError = new Error('Stats query failed');
      mockConn.simulateSelectFailure(dbError);

      await expect(repository.getQuestionStats()).rejects.toThrow(QuestionRepositoryError);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to get question stats',
          meta: expect.objectContaining({
            error: expect.objectContaining({
              message: 'Stats query failed',
            }),
          }),
        })
      );
    });
  });

  describe('withTransaction', () => {
    it('should execute operations within transaction context', async () => {
      let transactionExecuted = false;

      const result = await repository.withTransaction(async (txRepo: DrizzleQuestionRepository) => {
        expect(txRepo).toBeInstanceOf(DrizzleQuestionRepository);
        transactionExecuted = true;
        return 'success';
      });

      expect(transactionExecuted).toBe(true);
      expect(result).toBe('success');
    });

    it('should propagate errors from transaction operations', async () => {
      const txError = new Error('Transaction operation failed');

      await expect(
        repository.withTransaction(async () => {
          throw txError;
        })
      ).rejects.toThrow(txError);
    });
  });
});

/**
 * Unit tests for DrizzleQuizRepository using mocks
 * @fileoverview Tests event-sourcing and optimistic locking logic with mocked database
 */

import { UserId } from '@api/features/auth/domain/value-objects/UserId';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { TestClock } from '@api/test-support/utils/TestClock';
import postgres from 'postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuizSession } from '../../domain/aggregates/QuizSession';
import type { ExamType } from '../../domain/value-objects/ExamTypes';
import { AnswerId, OptionId, QuestionId, QuizSessionId } from '../../domain/value-objects/Ids';
import type {
  IQuestionDetailsService,
  QuestionDetails,
} from '../../domain/value-objects/QuestionDetailsService';
import { QuizConfig } from '../../domain/value-objects/QuizConfig';
import { QuizState } from '../../domain/value-objects/QuizState';
import { DrizzleQuizRepository } from './DrizzleQuizRepository';

// Extract PostgresError for proper mocking
const { PostgresError } = postgres;

// Mock types for testing
interface MockEventRow {
  sessionId: string;
  version: number;
  eventSequence: number;
  eventType: string;
  payload: unknown;
  occurredAt: Date;
}

interface MockSnapshotRow {
  sessionId: string;
  ownerId: string;
  state: string;
  expiresAt: Date;
  answers?: Record<string, unknown>;
  questionCount?: number;
  startedAt?: Date;
  completedAt?: Date | null;
  correctAnswers?: number | null;
}

// Mock question details service implementation
class MockQuestionDetailsService implements IQuestionDetailsService {
  private questionDetails: Map<string, QuestionDetails> = new Map();

  async getQuestionDetails(questionId: QuestionId): Promise<QuestionDetails | null> {
    return this.questionDetails.get(questionId.toString()) || null;
  }

  async getMultipleQuestionDetails(
    questionIds: QuestionId[]
  ): Promise<Map<QuestionId, QuestionDetails>> {
    const result = new Map<QuestionId, QuestionDetails>();
    for (const questionId of questionIds) {
      const details = this.questionDetails.get(questionId.toString());
      if (details) {
        result.set(questionId, details);
      }
    }
    return result;
  }

  // Helper method for tests to add question details
  addQuestionDetails(details: QuestionDetails): void {
    this.questionDetails.set(details.id.toString(), details);
  }

  clearQuestionDetails(): void {
    this.questionDetails.clear();
  }
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

// Mock transaction context that simulates database operations
class MockTransactionContext {
  private events: MockEventRow[] = [];
  private snapshots: MockSnapshotRow[] = [];
  private insertShouldFail = false;
  private insertFailureError: Error | null = null;
  private currentQueryContext: { type?: 'expired' | 'activeByUser'; now?: Date; userId?: string } =
    {};
  private adminFilterState?: string;

  // Mock query builder for select operations
  select(fields?: unknown) {
    // Handle count queries
    if (fields && typeof fields === 'object' && 'count' in fields) {
      return {
        from: (table: unknown) => {
          if (this.isSnapshotTable(table)) {
            return {
              // Direct where for simple count
              where: (_condition: unknown) => {
                const completedSnapshots = this.snapshots.filter((s) => s.state === 'COMPLETED');
                return [{ count: completedSnapshots.length }];
              },
              // innerJoin for admin count query
              innerJoin: (_table: unknown, _condition: unknown) => ({
                where: (_condition: unknown) => {
                  // Apply admin filter state to count
                  let filteredCount = this.snapshots.length;
                  if (this.adminFilterState) {
                    filteredCount = this.snapshots.filter(
                      (s) => s.state === this.adminFilterState
                    ).length;
                  }
                  return [{ count: filteredCount }];
                },
              }),
            };
          }
          return [{ count: this.events.length }];
        },
      };
    }

    // Handle aggregation queries for getAverageScore
    if (fields && typeof fields === 'object' && 'averagePercentage' in fields) {
      return {
        from: (table: unknown) => {
          if (this.isSnapshotTable(table)) {
            return {
              where: (_condition: unknown) => {
                const completedSnapshots = this.snapshots.filter((s) => s.state === 'COMPLETED');

                // Calculate aggregation values
                const validQuizzes = completedSnapshots.filter(
                  (s) => s.correctAnswers !== null && s.correctAnswers !== undefined
                );
                let averagePercentage = 0;

                if (validQuizzes.length > 0) {
                  const totalPercentage = validQuizzes.reduce((sum, quiz) => {
                    const correctAnswers = quiz.correctAnswers ?? 0;
                    const questionCount = quiz.questionCount ?? 1;
                    const percentage = (correctAnswers / questionCount) * 100;
                    return sum + percentage;
                  }, 0);
                  averagePercentage = Math.round(totalPercentage / validQuizzes.length);
                }

                return [
                  {
                    averagePercentage,
                    validQuizCount: validQuizzes.length,
                    totalCompletedQuizzes: completedSnapshots.length,
                  },
                ];
              },
            };
          }
          return [{ averagePercentage: 0, validQuizCount: 0, totalCompletedQuizzes: 0 }];
        },
      };
    }

    // Handle regular queries (not count queries)
    return {
      from: (table: unknown) => {
        if (this.isEventTable(table)) {
          return {
            where: (_condition: unknown) => ({
              orderBy: (..._columns: unknown[]) => this.events.slice(),
            }),
          };
        }
        if (this.isSnapshotTable(table)) {
          const self = this;
          return {
            // Direct where for getAverageScore or with limit chain
            where: (condition: unknown) => {
              // Check if we need to filter based on condition
              const shouldFilterCompleted = this.shouldFilterCompleted(condition);
              const shouldFilterByUser = this.shouldFilterByUser(condition);
              const shouldFilterExpired = this.shouldFilterExpired(condition);

              let filteredSnapshots = [...this.snapshots];

              if (shouldFilterCompleted) {
                filteredSnapshots = filteredSnapshots.filter((s) => s.state === 'COMPLETED');
              }

              if (shouldFilterByUser && this.currentQueryContext.userId) {
                filteredSnapshots = filteredSnapshots.filter(
                  (s) => s.ownerId === this.currentQueryContext.userId && s.state === 'IN_PROGRESS'
                );
              }

              if (shouldFilterExpired && this.currentQueryContext.now) {
                const now = this.currentQueryContext.now;
                filteredSnapshots = filteredSnapshots.filter(
                  (s) =>
                    s.state === 'IN_PROGRESS' &&
                    s.expiresAt &&
                    s.expiresAt.getTime() < now.getTime()
                );
              }

              // Return object that can chain to limit()
              const result = filteredSnapshots.map((s) => ({
                sessionId: s.sessionId,
                ownerId: s.ownerId,
                state: s.state,
                expiresAt: s.expiresAt,
                questionCount: s.questionCount || 0,
                answers: s.answers || null,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
              }));

              // Add limit method to the result array
              type ResultWithLimit = typeof result & { limit: (n: number) => typeof result };
              const resultWithLimit = result as ResultWithLimit;
              resultWithLimit.limit = (n: number) => result.slice(0, n);

              return resultWithLimit;
            },
            // innerJoin for findAllForAdmin
            innerJoin: (_table: unknown, _condition: unknown) => ({
              where: (_whereCondition: unknown) => {
                // Apply filters based on whereCondition
                let filteredSnapshots = [...self.snapshots];

                // This is a simplified filter - in real implementation it would parse the condition
                if (self.adminFilterState) {
                  filteredSnapshots = filteredSnapshots.filter(
                    (s) => s.state === self.adminFilterState
                  );
                }

                return {
                  orderBy: (..._columns: unknown[]) => ({
                    limit: (n: number) => ({
                      offset: (o: number) => {
                        return filteredSnapshots.slice(o, o + n).map((s) => ({
                          sessionId: s.sessionId,
                          userId: s.ownerId,
                          userEmail: `user-${s.ownerId}@example.com`,
                          state: s.state,
                          questionCount: s.questionCount || 0,
                          startedAt: s.startedAt || new Date(),
                          completedAt: s.completedAt || null,
                          answers: s.answers || null,
                        }));
                      },
                    }),
                  }),
                };
              },
            }),
          };
        }
        return {
          where: () => ({ orderBy: () => [], limit: () => [] }),
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

        if (this.isEventTable(table)) {
          if (Array.isArray(data)) {
            for (const event of data) {
              this.events.push(event as MockEventRow);
            }
          } else {
            this.events.push(data as MockEventRow);
          }
        }

        return Promise.resolve();
      },
    };
  }

  // Helper methods for testing
  addEvent(event: MockEventRow): void {
    this.events.push(event);
  }

  addSnapshot(snapshot: MockSnapshotRow): void {
    this.snapshots.push(snapshot);
  }

  clearEvents(): void {
    this.events = [];
  }

  clearSnapshots(): void {
    this.snapshots = [];
  }

  getEvents(): MockEventRow[] {
    return [...this.events];
  }

  simulateInsertFailure(error: Error): void {
    this.insertShouldFail = true;
    this.insertFailureError = error;
  }

  resetInsertFailure(): void {
    this.insertShouldFail = false;
    this.insertFailureError = null;
  }

  // Methods to set query context for different scenarios
  setExpiredSessionsContext(now: Date): void {
    this.currentQueryContext = { type: 'expired', now };
  }

  setActiveByUserContext(userId: string): void {
    this.currentQueryContext = { type: 'activeByUser', userId };
  }

  clearQueryContext(): void {
    this.currentQueryContext = {};
  }

  private getFilteredSnapshots(): MockSnapshotRow[] {
    return this.snapshots.filter((snapshot) => {
      if (!this.isValidInProgressSnapshot(snapshot)) return false;
      return this.applyContextFilters(snapshot);
    });
  }

  private isValidInProgressSnapshot(snapshot: MockSnapshotRow): boolean {
    return snapshot.state === 'IN_PROGRESS';
  }

  private applyContextFilters(snapshot: MockSnapshotRow): boolean {
    switch (this.currentQueryContext.type) {
      case 'expired':
        return this.isExpiredSnapshot(snapshot);
      case 'activeByUser':
        return this.isActiveByUserSnapshot(snapshot);
      default:
        return true;
    }
  }

  private isExpiredSnapshot(snapshot: MockSnapshotRow): boolean {
    const now = this.currentQueryContext.now;
    if (now && snapshot.expiresAt) {
      return snapshot.expiresAt.getTime() < now.getTime();
    }
    return false;
  }

  private isActiveByUserSnapshot(snapshot: MockSnapshotRow): boolean {
    const userId = this.currentQueryContext.userId;
    return userId ? snapshot.ownerId === userId : false;
  }

  private isEventTable(table: unknown): boolean {
    // Check if this looks like an event table by checking property names
    if (typeof table !== 'object' || table === null) return false;
    const keys = Object.keys(table as Record<string, unknown>);
    // Event table has eventType, eventSequence, payload but no ownerId
    return keys.includes('eventType') || keys.includes('eventSequence') || keys.includes('payload');
  }

  private isSnapshotTable(table: unknown): boolean {
    // Check if this looks like a snapshot table by checking property names
    if (typeof table !== 'object' || table === null) return false;
    const keys = Object.keys(table as Record<string, unknown>);
    // Snapshot table has ownerId, expiresAt but no eventType
    return keys.includes('ownerId') && keys.includes('expiresAt') && !keys.includes('eventType');
  }

  // Helper methods for condition checking
  private shouldFilterCompleted(_condition: unknown): boolean {
    // Only filter by COMPLETED if we're not doing user/expired queries
    return (
      this.currentQueryContext.type !== 'activeByUser' &&
      this.currentQueryContext.type !== 'expired'
    );
  }

  private shouldFilterByUser(_condition: unknown): boolean {
    // Check if this is a user-specific query
    return this.currentQueryContext.type === 'activeByUser';
  }

  private shouldFilterExpired(_condition: unknown): boolean {
    // Check if this is an expired sessions query
    return this.currentQueryContext.type === 'expired';
  }

  private isCompletedStateCondition(_condition: unknown): boolean {
    // Simple check - in real implementation would parse the SQL condition
    // For getAverageScore, we're looking for completed state
    return true; // Default to true for getAverageScore queries
  }

  // Method to set admin filter state for testing
  setAdminFilterState(state: string): void {
    this.adminFilterState = state;
  }

  clearAdminFilterState(): void {
    this.adminFilterState = undefined;
  }
}

describe('DrizzleQuizRepository (Unit Tests)', () => {
  let mockTrx: MockTransactionContext;
  let mockLogger: MockLogger;
  let mockQuestionDetailsService: MockQuestionDetailsService;
  let repository: DrizzleQuizRepository;
  let clock: TestClock;

  beforeEach(() => {
    mockTrx = new MockTransactionContext();
    mockLogger = new MockLogger();
    mockQuestionDetailsService = new MockQuestionDetailsService();
    repository = new DrizzleQuizRepository(
      mockTrx as never,
      mockQuestionDetailsService,
      mockLogger
    );
    clock = new TestClock(new Date('2025-01-01T12:00:00Z'));
    // Clear any previous query context
    mockTrx.clearQueryContext();
  });

  describe('findById', () => {
    it('should return null when no events exist for session', async () => {
      const sessionId = QuizSessionId.generate();

      const result = await repository.findById(sessionId);

      expect(result).toBeNull();
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'Quiz session not found',
          meta: { sessionId },
        })
      );
    });

    it('should reconstruct QuizSession from events', async () => {
      const sessionId = QuizSessionId.generate();
      const userId = UserId.generate();
      const questionIds = [QuestionId.generate(), QuestionId.generate()];

      // Add mock quiz started event
      const startedEvent: MockEventRow = {
        sessionId: sessionId.toString(),
        version: 1,
        eventSequence: 1,
        eventType: 'quiz.started',
        payload: {
          sessionId: sessionId.toString(),
          ownerId: userId.toString(),
          config: {
            examType: 'CCNA',
            category: null,
            questionCount: 2,
            timeLimit: 60,
            difficulty: 'MIXED',
            enforceSequentialAnswering: false,
            requireAllAnswers: false,
            autoCompleteWhenAllAnswered: true,
            fallbackLimitSeconds: 14400,
          },
          questionIds: questionIds.map((id) => id.toString()),
          startedAt: new Date('2025-01-01T10:00:00Z'),
          expiresAt: new Date('2025-01-01T14:00:00Z'),
        },
        occurredAt: new Date('2025-01-01T10:00:00Z'),
      };

      mockTrx.addEvent(startedEvent);

      const result = await repository.findById(sessionId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(sessionId);
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'Quiz session loaded successfully',
          meta: { sessionId, eventCount: 1 },
        })
      );
    });

    it('should handle unknown event type and throw error', async () => {
      const sessionId = QuizSessionId.generate();

      // Add event with unknown type
      const unknownEvent: MockEventRow = {
        sessionId: sessionId.toString(),
        version: 1,
        eventSequence: 1,
        eventType: 'quiz.unknown_event',
        payload: {},
        occurredAt: new Date(),
      };

      mockTrx.addEvent(unknownEvent);

      await expect(repository.findById(sessionId)).rejects.toThrow(
        "unsupported eventType 'quiz.unknown_event'"
      );
    });

    it('should handle invalid event payload and throw error', async () => {
      const sessionId = QuizSessionId.generate();

      // Add event with invalid payload
      const invalidEvent: MockEventRow = {
        sessionId: sessionId.toString(),
        version: 1,
        eventSequence: 1,
        eventType: 'quiz.started',
        payload: {
          // Missing required fields
          questionCount: 'invalid',
        },
        occurredAt: new Date(),
      };

      mockTrx.addEvent(invalidEvent);

      await expect(repository.findById(sessionId)).rejects.toThrow(
        "invalid payload for 'quiz.started'"
      );
    });

    it('should log and re-throw database errors', async () => {
      const sessionId = QuizSessionId.generate();

      // Mock database error
      const mockError = new Error('Database connection failed');
      vi.spyOn(mockTrx, 'select').mockImplementation(() => {
        throw mockError;
      });

      await expect(repository.findById(sessionId)).rejects.toThrow(mockError);

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to find quiz session',
          meta: expect.objectContaining({
            sessionId: sessionId.toString(),
            error: 'Database connection failed',
          }),
        })
      );
    });
  });

  describe('save', () => {
    it('should not persist when no uncommitted events exist', async () => {
      const sessionId = QuizSessionId.generate();
      const session = QuizSession.createForReplay(sessionId);

      await repository.save(session);

      expect(mockTrx.getEvents()).toHaveLength(0);
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'No events to persist for session',
          meta: { sessionId },
        })
      );
    });

    it('should persist uncommitted events', async () => {
      const userId = UserId.generate();
      const questionIds = [QuestionId.generate(), QuestionId.generate()];

      const config = QuizConfig.create({
        examType: 'CCNA' as ExamType,
        questionCount: 2,
        timeLimit: 60,
      });

      expect(config.success).toBe(true);
      if (!config.success) throw new Error('Failed to create config');

      const sessionResult = QuizSession.startNew(userId, config.data, questionIds, clock);

      expect(sessionResult.success).toBe(true);
      if (!sessionResult.success) throw new Error('Failed to start session');

      const session = sessionResult.data;

      await repository.save(session);

      const events = mockTrx.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('quiz.started');
      expect(events[0].sessionId).toBe(session.id);

      expect(mockLogger.infoMessages).toContainEqual(
        expect.objectContaining({
          message: 'Quiz session saved successfully',
          meta: { sessionId: session.id, eventCount: 1 },
        })
      );
    });

    it('should handle optimistic lock error (PostgreSQL unique violation)', async () => {
      const userId = UserId.generate();
      const questionIds = [QuestionId.generate()];

      const config = QuizConfig.create({
        examType: 'CCNA' as ExamType,
        questionCount: 1,
        timeLimit: 60,
      });

      expect(config.success).toBe(true);
      if (!config.success) throw new Error('Failed to create config');

      const sessionResult = QuizSession.startNew(userId, config.data, questionIds, clock);

      expect(sessionResult.success).toBe(true);
      if (!sessionResult.success) throw new Error('Failed to start session');

      const session = sessionResult.data;

      // Mock PostgreSQL unique violation error
      const postgresError = new PostgresError('duplicate key value violates unique constraint');
      Object.assign(postgresError, { code: '23505' });

      mockTrx.simulateInsertFailure(postgresError);

      await expect(repository.save(session)).rejects.toThrow(
        'Concurrent modification detected for session'
      );

      expect(mockLogger.errorMessages).toHaveLength(0); // Should be warned, not errored
    });

    it('should handle other database errors', async () => {
      const userId = UserId.generate();
      const questionIds = [QuestionId.generate()];

      const config = QuizConfig.create({
        examType: 'CCNA' as ExamType,
        questionCount: 1,
        timeLimit: 60,
      });

      expect(config.success).toBe(true);
      if (!config.success) throw new Error('Failed to create config');

      const sessionResult = QuizSession.startNew(userId, config.data, questionIds, clock);

      expect(sessionResult.success).toBe(true);
      if (!sessionResult.success) throw new Error('Failed to start session');

      const session = sessionResult.data;

      // Mock generic database error
      const dbError = new Error('Connection timeout');
      mockTrx.simulateInsertFailure(dbError);

      await expect(repository.save(session)).rejects.toThrow(
        'Quiz repository save failed: Failed to save quiz session'
      );

      expect(mockLogger.errorMessages).toContainEqual(
        expect.objectContaining({
          message: 'Failed to save quiz session',
          meta: expect.objectContaining({
            sessionId: session.id,
            error: 'Connection timeout',
          }),
        })
      );
    });
  });

  describe('findExpiredSessions', () => {
    it('should return empty array when no expired sessions exist', async () => {
      const now = new Date('2025-01-01T15:00:00Z');

      const result = await repository.findExpiredSessions(now, 10);

      expect(result).toEqual([]);
    });

    it('should find expired sessions and reconstruct them', async () => {
      const sessionId = QuizSessionId.generate();
      const userId = UserId.generate();
      const now = new Date('2025-01-01T15:00:00Z');
      const expiredTime = new Date('2025-01-01T14:00:00Z');

      // Add expired session snapshot
      mockTrx.addSnapshot({
        sessionId: sessionId.toString(),
        ownerId: userId.toString(),
        state: 'IN_PROGRESS',
        expiresAt: expiredTime,
      });

      // Add corresponding event
      mockTrx.addEvent({
        sessionId: sessionId.toString(),
        version: 1,
        eventSequence: 1,
        eventType: 'quiz.started',
        payload: {
          sessionId: sessionId.toString(),
          ownerId: userId.toString(),
          config: {
            examType: 'CCNA',
            category: null,
            questionCount: 1,
            timeLimit: 60,
            difficulty: 'MIXED',
            enforceSequentialAnswering: false,
            requireAllAnswers: false,
            autoCompleteWhenAllAnswered: true,
            fallbackLimitSeconds: 14400,
          },
          questionIds: [QuestionId.generate().toString()],
          startedAt: new Date('2025-01-01T13:00:00Z'),
          expiresAt: expiredTime,
        },
        occurredAt: new Date('2025-01-01T13:00:00Z'),
      });

      // Set query context for expired sessions
      mockTrx.setExpiredSessionsContext(now);

      const result = await repository.findExpiredSessions(now, 10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(sessionId);
    });
  });

  describe('findActiveByUser', () => {
    it('should return null when user has no active sessions', async () => {
      const userId = UserId.generate();

      const result = await repository.findActiveByUser(userId);

      expect(result).toBeNull();
    });

    it('should find active session and reconstruct it', async () => {
      const sessionId = QuizSessionId.generate();
      const userId = UserId.generate();

      // Add active session snapshot
      mockTrx.addSnapshot({
        sessionId: sessionId.toString(),
        ownerId: userId.toString(),
        state: 'IN_PROGRESS',
        expiresAt: new Date('2025-01-01T16:00:00Z'),
      });

      // Add corresponding event
      mockTrx.addEvent({
        sessionId: sessionId.toString(),
        version: 1,
        eventSequence: 1,
        eventType: 'quiz.started',
        payload: {
          sessionId: sessionId.toString(),
          ownerId: userId.toString(),
          config: {
            examType: 'CCNA',
            category: null,
            questionCount: 1,
            timeLimit: 60,
            difficulty: 'MIXED',
            enforceSequentialAnswering: false,
            requireAllAnswers: false,
            autoCompleteWhenAllAnswered: true,
            fallbackLimitSeconds: 14400,
          },
          questionIds: [QuestionId.generate().toString()],
          startedAt: new Date('2025-01-01T12:00:00Z'),
          expiresAt: new Date('2025-01-01T16:00:00Z'),
        },
        occurredAt: new Date('2025-01-01T12:00:00Z'),
      });

      // Set query context for active user sessions
      mockTrx.setActiveByUserContext(userId.toString());

      const result = await repository.findActiveByUser(userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(sessionId);
    });
  });

  describe('event mapping', () => {
    it('should sort events correctly by version and sequence', async () => {
      const sessionId = QuizSessionId.generate();
      const userId = UserId.generate();
      const questionId = QuestionId.generate();
      const answerId = AnswerId.generate();

      // Add events in wrong order to test sorting
      mockTrx.addEvent({
        sessionId: sessionId.toString(),
        version: 2,
        eventSequence: 1,
        eventType: 'quiz.answer_submitted',
        payload: {
          sessionId: sessionId.toString(),
          answerId: answerId.toString(),
          questionId: questionId.toString(),
          selectedOptions: [OptionId.generate().toString()],
          submittedAt: new Date('2025-01-01T12:05:00Z'),
        },
        occurredAt: new Date('2025-01-01T12:05:00Z'),
      });

      mockTrx.addEvent({
        sessionId: sessionId.toString(),
        version: 1,
        eventSequence: 1,
        eventType: 'quiz.started',
        payload: {
          sessionId: sessionId.toString(),
          ownerId: userId.toString(),
          config: {
            examType: 'CCNA',
            category: null,
            questionCount: 1,
            timeLimit: 60,
            difficulty: 'MIXED',
            enforceSequentialAnswering: false,
            requireAllAnswers: false,
            autoCompleteWhenAllAnswered: true,
            fallbackLimitSeconds: 14400,
          },
          questionIds: [questionId.toString()],
          startedAt: new Date('2025-01-01T12:00:00Z'),
          expiresAt: new Date('2025-01-01T16:00:00Z'),
        },
        occurredAt: new Date('2025-01-01T12:00:00Z'),
      });

      const result = await repository.findById(sessionId);

      expect(result).toBeDefined();
      // If events were sorted correctly, the session should be reconstructed properly
      expect(result?.version).toBe(2);
    });
  });

  describe('getAverageScore', () => {
    it('should return 0 when no completed quizzes exist', async () => {
      const result = await repository.getAverageScore();

      expect(result).toBe(0);
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'No completed quizzes with valid scores found',
        })
      );
    });

    it('should calculate average score for completed quizzes', async () => {
      const sessionId1 = QuizSessionId.generate();
      const sessionId2 = QuizSessionId.generate();
      const questionId1 = QuestionId.generate();
      const questionId2 = QuestionId.generate();
      const optionId1 = OptionId.generate();
      const optionId2 = OptionId.generate();
      const optionId3 = OptionId.generate();
      const optionId4 = OptionId.generate();

      // Add question details
      mockQuestionDetailsService.addQuestionDetails({
        id: questionId1,
        text: 'Question 1',
        options: [
          { id: optionId1.toString(), text: 'Option 1', isCorrect: true },
          { id: optionId2.toString(), text: 'Option 2', isCorrect: false },
        ],
        correctOptionIds: [optionId1],
      });

      mockQuestionDetailsService.addQuestionDetails({
        id: questionId2,
        text: 'Question 2',
        options: [
          { id: optionId3.toString(), text: 'Option 3', isCorrect: false },
          { id: optionId4.toString(), text: 'Option 4', isCorrect: true },
        ],
        correctOptionIds: [optionId4],
      });

      // Add completed quiz with 100% score (both correct)
      mockTrx.addSnapshot({
        sessionId: sessionId1.toString(),
        ownerId: UserId.generate().toString(),
        state: 'COMPLETED',
        expiresAt: new Date(),
        questionCount: 2,
        correctAnswers: 2, // 2 out of 2 correct = 100%
        answers: {
          answer1: {
            answerId: AnswerId.generate().toString(),
            questionId: questionId1.toString(),
            selectedOptionIds: [optionId1.toString()], // Correct
            answeredAt: new Date().toISOString(),
          },
          answer2: {
            answerId: AnswerId.generate().toString(),
            questionId: questionId2.toString(),
            selectedOptionIds: [optionId4.toString()], // Correct
            answeredAt: new Date().toISOString(),
          },
        },
      });

      // Add completed quiz with 50% score (one correct)
      mockTrx.addSnapshot({
        sessionId: sessionId2.toString(),
        ownerId: UserId.generate().toString(),
        state: 'COMPLETED',
        expiresAt: new Date(),
        questionCount: 2,
        correctAnswers: 1, // 1 out of 2 correct = 50%
        answers: {
          answer1: {
            answerId: AnswerId.generate().toString(),
            questionId: questionId1.toString(),
            selectedOptionIds: [optionId1.toString()], // Correct
            answeredAt: new Date().toISOString(),
          },
          answer2: {
            answerId: AnswerId.generate().toString(),
            questionId: questionId2.toString(),
            selectedOptionIds: [optionId3.toString()], // Incorrect
            answeredAt: new Date().toISOString(),
          },
        },
      });

      const result = await repository.getAverageScore();

      // Average of 100% and 50% = 75%
      expect(result).toBe(75);
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'Average score calculated via database aggregation',
          meta: expect.objectContaining({
            totalCompletedQuizzes: 2,
            validQuizzes: 2,
            averageScore: 75,
          }),
        })
      );
    });

    it('should skip quizzes without answers', async () => {
      // Add completed quiz without answers (no correctAnswers field)
      mockTrx.addSnapshot({
        sessionId: QuizSessionId.generate().toString(),
        ownerId: UserId.generate().toString(),
        state: 'COMPLETED',
        expiresAt: new Date(),
        questionCount: 2,
        answers: undefined,
        correctAnswers: null, // No correctAnswers calculated
      });

      const result = await repository.getAverageScore();

      expect(result).toBe(0);
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'No completed quizzes with valid scores found',
        })
      );
    });

    it('should handle missing question details gracefully', async () => {
      const questionId = QuestionId.generate();

      // Add completed quiz with answers but no correctAnswers (failed calculation during save)
      mockTrx.addSnapshot({
        sessionId: QuizSessionId.generate().toString(),
        ownerId: UserId.generate().toString(),
        state: 'COMPLETED',
        expiresAt: new Date(),
        questionCount: 1,
        correctAnswers: null, // Score calculation failed during snapshot update
        answers: {
          answer1: {
            answerId: AnswerId.generate().toString(),
            questionId: questionId.toString(),
            selectedOptionIds: [OptionId.generate().toString()],
            answeredAt: new Date().toISOString(),
          },
        },
      });

      const result = await repository.getAverageScore();

      // When correctAnswers is null (due to missing question details during save),
      // the quiz is excluded from aggregation
      expect(result).toBe(0);
      expect(mockLogger.debugMessages).toContainEqual(
        expect.objectContaining({
          message: 'No completed quizzes with valid scores found',
        })
      );
    });
  });

  describe('findAllForAdmin', () => {
    it('should return paginated results with user info', async () => {
      const sessionId = QuizSessionId.generate();
      const userId = UserId.generate();
      const questionId = QuestionId.generate();
      const optionId1 = OptionId.generate();
      const optionId2 = OptionId.generate();

      // Add question details
      mockQuestionDetailsService.addQuestionDetails({
        id: questionId,
        text: 'Question 1',
        options: [
          { id: optionId1.toString(), text: 'Option 1', isCorrect: true },
          { id: optionId2.toString(), text: 'Option 2', isCorrect: false },
        ],
        correctOptionIds: [optionId1],
      });

      // Add completed quiz
      mockTrx.addSnapshot({
        sessionId: sessionId.toString(),
        ownerId: userId.toString(),
        state: 'COMPLETED',
        expiresAt: new Date(),
        questionCount: 1,
        startedAt: new Date('2025-01-01T10:00:00Z'),
        completedAt: new Date('2025-01-01T10:30:00Z'),
        answers: {
          answer1: {
            answerId: AnswerId.generate().toString(),
            questionId: questionId.toString(),
            selectedOptionIds: [optionId1.toString()], // Correct answer
            answeredAt: new Date().toISOString(),
          },
        },
      });

      const result = await repository.findAllForAdmin({
        page: 1,
        pageSize: 10,
        filters: {},
      });

      expect(result).toEqual({
        items: [
          expect.objectContaining({
            sessionId: sessionId.toString(),
            userId: userId.toString(),
            userEmail: `user-${userId.toString()}@example.com`,
            state: QuizState.Completed,
            score: 100, // 100% score
            questionCount: 1,
            startedAt: new Date('2025-01-01T10:00:00Z'),
            completedAt: new Date('2025-01-01T10:30:00Z'),
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });
    });

    it('should calculate scores only for completed quizzes', async () => {
      const sessionId1 = QuizSessionId.generate();
      const sessionId2 = QuizSessionId.generate();
      const userId = UserId.generate();

      // Add in-progress quiz
      mockTrx.addSnapshot({
        sessionId: sessionId1.toString(),
        ownerId: userId.toString(),
        state: 'IN_PROGRESS',
        expiresAt: new Date(),
        questionCount: 2,
        startedAt: new Date(),
        answers: {
          answer1: {
            answerId: AnswerId.generate().toString(),
            questionId: QuestionId.generate().toString(),
            selectedOptionIds: [OptionId.generate().toString()],
            answeredAt: new Date().toISOString(),
          },
        },
      });

      // Add completed quiz
      mockTrx.addSnapshot({
        sessionId: sessionId2.toString(),
        ownerId: userId.toString(),
        state: 'COMPLETED',
        expiresAt: new Date(),
        questionCount: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        answers: {},
      });

      const result = await repository.findAllForAdmin({
        page: 1,
        pageSize: 10,
        filters: {},
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].score).toBeNull(); // In-progress quiz
      expect(result.items[1].score).toBeNull(); // Completed but no answers
    });

    it('should handle quiz state filtering', async () => {
      const sessionId = QuizSessionId.generate();
      const userId = UserId.generate();

      // Add completed quiz
      mockTrx.addSnapshot({
        sessionId: sessionId.toString(),
        ownerId: userId.toString(),
        state: 'COMPLETED',
        expiresAt: new Date(),
        questionCount: 1,
        startedAt: new Date(),
        completedAt: new Date(),
      });

      // Add in-progress quiz
      mockTrx.addSnapshot({
        sessionId: QuizSessionId.generate().toString(),
        ownerId: userId.toString(),
        state: 'IN_PROGRESS',
        expiresAt: new Date(),
        questionCount: 1,
        startedAt: new Date(),
      });

      // Set the admin filter state for the mock
      mockTrx.setAdminFilterState('COMPLETED');

      const result = await repository.findAllForAdmin({
        page: 1,
        pageSize: 10,
        filters: { state: QuizState.Completed },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].state).toBe(QuizState.Completed);
      expect(result.total).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      // Add 5 quizzes
      for (let i = 0; i < 5; i++) {
        mockTrx.addSnapshot({
          sessionId: QuizSessionId.generate().toString(),
          ownerId: UserId.generate().toString(),
          state: 'COMPLETED',
          expiresAt: new Date(),
          questionCount: 1,
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }

      const result = await repository.findAllForAdmin({
        page: 2,
        pageSize: 2,
        filters: {},
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(2);
    });

    it('should handle score calculation errors gracefully', async () => {
      const sessionId = QuizSessionId.generate();
      const questionId = QuestionId.generate();

      // Add completed quiz with answers but no question details
      mockTrx.addSnapshot({
        sessionId: sessionId.toString(),
        ownerId: UserId.generate().toString(),
        state: 'COMPLETED',
        expiresAt: new Date(),
        questionCount: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        answers: {
          answer1: {
            answerId: AnswerId.generate().toString(),
            questionId: questionId.toString(),
            selectedOptionIds: [OptionId.generate().toString()],
            answeredAt: new Date().toISOString(),
          },
        },
      });

      const result = await repository.findAllForAdmin({
        page: 1,
        pageSize: 10,
        filters: {},
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].score).toBeNull(); // Score calculation failed
      expect(mockLogger.warnMessages).toContainEqual(
        expect.objectContaining({
          message: 'Missing question details for score calculation',
        })
      );
    });
  });
});

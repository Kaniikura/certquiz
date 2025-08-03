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
import { QuizConfig } from '../../domain/value-objects/QuizConfig';
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
}

// Mock logger implementation
class MockLogger implements LoggerPort {
  public debugMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public infoMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  public errorMessages: Array<{ message: string; meta?: Record<string, unknown> }> = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.debugMessages.push({ message, meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.infoMessages.push({ message, meta });
  }

  warn(_message: string, _meta?: Record<string, unknown>): void {
    // Not used in these tests
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

  // Mock query builder for select operations
  select() {
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
          return {
            where: (_condition: unknown) => ({
              limit: (n: number) => {
                return this.getFilteredSnapshots().slice(0, n);
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
}

describe('DrizzleQuizRepository (Unit Tests)', () => {
  let mockTrx: MockTransactionContext;
  let mockLogger: MockLogger;
  let repository: DrizzleQuizRepository;
  let clock: TestClock;

  beforeEach(() => {
    mockTrx = new MockTransactionContext();
    mockLogger = new MockLogger();
    repository = new DrizzleQuizRepository(mockTrx as never, mockLogger);
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
});

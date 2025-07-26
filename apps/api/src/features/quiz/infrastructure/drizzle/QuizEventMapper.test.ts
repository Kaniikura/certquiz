import { describe, expect, it } from 'vitest';
import { mapEventToQuizEvent, mapRowToQuizState } from './QuizEventMapper';
import type { QuizSessionEventRow } from './schema/quizSession';

describe('QuizEventMapper', () => {
  const baseEventRow: Omit<QuizSessionEventRow, 'eventType' | 'payload'> = {
    sessionId: '123e4567-e89b-12d3-a456-426614174000',
    version: 1,
    occurredAt: new Date('2024-01-15T10:00:00Z'),
    eventSequence: 1,
  };

  describe('mapEventToQuizEvent', () => {
    it('should map QuizStartedEvent', () => {
      const eventRow: QuizSessionEventRow = {
        ...baseEventRow,
        eventType: 'quiz.started',
        payload: {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          ownerId: '456e7890-e89b-12d3-a456-426614174000',
          config: {
            examType: 'CCNA',
            category: 'Routing',
            questionCount: 10,
            timeLimit: 30,
            difficulty: 'Mixed',
            enforceSequentialAnswering: false,
            requireAllAnswers: false,
            autoCompleteWhenAllAnswered: true,
            fallbackLimitSeconds: 14400,
          },
          questionIds: [
            'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            'c3d4e5f6-a7b8-9012-cdef-123456789012',
          ],
          startedAt: new Date('2024-01-15T10:00:00Z'),
          expiresAt: new Date('2024-01-15T10:30:00Z'),
        },
      };

      const result = mapEventToQuizEvent(eventRow);

      expect(result.success).toBe(true);
      if (result.success) {
        const event = result.data;
        expect(event.eventType).toBe('quiz.started');
        expect(event.aggregateId).toBe(eventRow.sessionId);
        expect(event.version).toBe(eventRow.version);
        expect(event.occurredAt).toEqual(eventRow.occurredAt);

        const payload = event.payload as {
          userId: string;
          configSnapshot: { questionCount: number };
          questionIds: string[];
        };
        expect(payload.userId).toBe('456e7890-e89b-12d3-a456-426614174000');
        expect(payload.configSnapshot.questionCount).toBe(10);
        expect(payload.questionIds).toHaveLength(3);
      }
    });

    it('should map AnswerSubmittedEvent', () => {
      const eventRow: QuizSessionEventRow = {
        ...baseEventRow,
        eventType: 'quiz.answer_submitted',
        payload: {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          answerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          questionId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          selectedOptions: [
            'c3d4e5f6-a7b8-9012-cdef-123456789012',
            'd4e5f6a7-b8c9-0123-defa-234567890123',
          ],
          submittedAt: new Date('2024-01-15T10:05:00Z'),
        },
      };

      const result = mapEventToQuizEvent(eventRow);

      expect(result.success).toBe(true);
      if (result.success) {
        const event = result.data;
        expect(event.eventType).toBe('quiz.answer_submitted');

        const payload = event.payload as {
          answerId: string;
          questionId: string;
          selectedOptionIds: string[];
        };
        expect(payload.answerId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        expect(payload.questionId).toBe('b2c3d4e5-f6a7-8901-bcde-f12345678901');
        expect(payload.selectedOptionIds).toEqual([
          'c3d4e5f6-a7b8-9012-cdef-123456789012',
          'd4e5f6a7-b8c9-0123-defa-234567890123',
        ]);
      }
    });

    it('should map QuizCompletedEvent', () => {
      const eventRow: QuizSessionEventRow = {
        ...baseEventRow,
        eventType: 'quiz.completed',
        payload: {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          totalQuestions: 10,
          answeredQuestions: 10,
          completedAt: new Date('2024-01-15T10:25:00Z'),
        },
      };

      const result = mapEventToQuizEvent(eventRow);

      expect(result.success).toBe(true);
      if (result.success) {
        const event = result.data;
        expect(event.eventType).toBe('quiz.completed');

        const payload = event.payload as {
          totalCount: number;
          answeredCount: number;
        };
        expect(payload.totalCount).toBe(10);
        expect(payload.answeredCount).toBe(10);
      }
    });

    it('should map QuizExpiredEvent', () => {
      const eventRow: QuizSessionEventRow = {
        ...baseEventRow,
        eventType: 'quiz.expired',
        payload: {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          totalQuestions: 10,
          answeredQuestions: 7,
          expiredAt: new Date('2024-01-15T10:30:00Z'),
        },
      };

      const result = mapEventToQuizEvent(eventRow);

      expect(result.success).toBe(true);
      if (result.success) {
        const event = result.data;
        expect(event.eventType).toBe('quiz.expired');

        const payload = event.payload as {
          expiredAt: Date;
        };
        expect(payload.expiredAt).toEqual(new Date('2024-01-15T10:30:00Z'));
      }
    });

    it('should fail with unknown event type', () => {
      const eventRow: QuizSessionEventRow = {
        ...baseEventRow,
        eventType: 'quiz.unknown' as never,
        payload: {},
      };

      const result = mapEventToQuizEvent(eventRow);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Unknown event type');
      }
    });

    it('should fail with invalid payload structure', () => {
      const eventRow: QuizSessionEventRow = {
        ...baseEventRow,
        eventType: 'quiz.started',
        payload: {
          // Missing required fields for quiz.started
        },
      };

      const result = mapEventToQuizEvent(eventRow);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid payload');
      }
    });

    it('should generate deterministic event ID', () => {
      const eventRow: QuizSessionEventRow = {
        ...baseEventRow,
        eventType: 'quiz.answer_submitted',
        payload: {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          answerId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
          questionId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
          selectedOptions: ['a7b8c9d0-e1f2-3456-abcd-567890123456'],
          submittedAt: new Date('2024-01-15T10:05:00Z'),
        },
      };

      const result1 = mapEventToQuizEvent(eventRow);
      const result2 = mapEventToQuizEvent(eventRow);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.eventId).toBe(result2.data.eventId);
      }
    });
  });

  describe('mapRowToQuizState', () => {
    const validSnapshot = {
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      ownerId: '456e7890-e89b-12d3-a456-426614174000',
      state: 'IN_PROGRESS' as const,
      questionCount: 10,
      currentQuestionIndex: 3,
      startedAt: new Date('2024-01-15T10:00:00Z'),
      expiresAt: new Date('2024-01-15T10:30:00Z'),
      completedAt: null,
      version: 5,
      config: {
        totalQuestions: 10,
        timeLimit: 30,
        examType: 'CCNA',
        categories: ['Routing', 'Switching'],
        difficulty: 'Mixed',
        questionsPerCategory: {},
      },
      questionOrder: ['q1-uuid', 'q2-uuid', 'q3-uuid', 'q4-uuid', 'q5-uuid'],
      answers: {
        'q1-uuid': {
          answerId: 'ans1',
          questionId: 'q1-uuid',
          selectedOptions: ['opt1'],
          submittedAt: new Date('2024-01-15T10:05:00Z').toISOString(),
        },
        'q2-uuid': {
          answerId: 'ans2',
          questionId: 'q2-uuid',
          selectedOptions: ['opt2', 'opt3'],
          submittedAt: new Date('2024-01-15T10:10:00Z').toISOString(),
        },
      },
      updatedAt: new Date('2024-01-15T10:15:00Z'),
    };

    it('should map valid snapshot to quiz state', () => {
      const result = mapRowToQuizState(validSnapshot);

      expect(result.success).toBe(true);
      if (result.success) {
        const state = result.data;
        expect(state.sessionId).toBe(validSnapshot.sessionId);
        expect(state.ownerId).toBe(validSnapshot.ownerId);
        expect(state.state).toBe('IN_PROGRESS');
        expect(state.currentQuestionIndex).toBe(3);
        expect(state.version).toBe(5);
        expect((state.config as { totalQuestions: number }).totalQuestions).toBe(10);
        expect(state.questionOrder).toHaveLength(5);
        expect(Object.keys(state.answers)).toHaveLength(2);
      }
    });

    it('should handle completed state', () => {
      const completedSnapshot = {
        ...validSnapshot,
        state: 'COMPLETED' as const,
        completedAt: new Date('2024-01-15T10:25:00Z'),
        currentQuestionIndex: 9,
      };

      const result = mapRowToQuizState(completedSnapshot);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe('COMPLETED');
        expect(result.data.completedAt).toEqual(completedSnapshot.completedAt);
      }
    });

    it('should handle expired state', () => {
      const expiredSnapshot = {
        ...validSnapshot,
        state: 'EXPIRED' as const,
        completedAt: new Date('2024-01-15T10:30:00Z'),
      };

      const result = mapRowToQuizState(expiredSnapshot);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe('EXPIRED');
        expect(result.data.completedAt).toEqual(expiredSnapshot.completedAt);
      }
    });

    it('should handle empty answers', () => {
      const snapshotWithNoAnswers = {
        ...validSnapshot,
        answers: null,
        currentQuestionIndex: 0,
      };

      const result = mapRowToQuizState(snapshotWithNoAnswers);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.keys(result.data.answers)).toHaveLength(0);
      }
    });

    it('should fail with invalid answer structure', () => {
      const snapshotWithInvalidAnswers = {
        ...validSnapshot,
        answers: 'not-an-object' as never,
      };

      const result = mapRowToQuizState(snapshotWithInvalidAnswers);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('answers: Expected object, received string');
      }
    });

    it('should fail when ownerId is missing', () => {
      const snapshotMissingOwnerId = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        state: 'IN_PROGRESS' as const,
        questionCount: 10,
        currentQuestionIndex: 3,
        startedAt: new Date('2024-01-15T10:00:00Z'),
        expiresAt: new Date('2024-01-15T10:30:00Z'),
        completedAt: null,
        version: 5,
        config: {
          totalQuestions: 10,
          timeLimit: 30,
          examType: 'CCNA',
          categories: ['Routing', 'Switching'],
          difficulty: 'Mixed',
          questionsPerCategory: {},
        },
        questionOrder: ['q1-uuid', 'q2-uuid', 'q3-uuid'],
        answers: {},
        updatedAt: new Date('2024-01-15T10:15:00Z'),
        // ownerId is deliberately omitted
      } as never;

      const result = mapRowToQuizState(snapshotMissingOwnerId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('ownerId: Required');
      }
    });

    it('should fail when state is missing', () => {
      const snapshotMissingState = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        ownerId: '456e7890-e89b-12d3-a456-426614174000',
        questionCount: 10,
        currentQuestionIndex: 3,
        startedAt: new Date('2024-01-15T10:00:00Z'),
        expiresAt: new Date('2024-01-15T10:30:00Z'),
        completedAt: null,
        version: 5,
        config: {
          totalQuestions: 10,
          timeLimit: 30,
          examType: 'CCNA',
          categories: ['Routing', 'Switching'],
          difficulty: 'Mixed',
          questionsPerCategory: {},
        },
        questionOrder: ['q1-uuid', 'q2-uuid', 'q3-uuid'],
        answers: {},
        updatedAt: new Date('2024-01-15T10:15:00Z'),
        // state is deliberately omitted
      } as never;

      const result = mapRowToQuizState(snapshotMissingState);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain(
          'state: Invalid state: must be IN_PROGRESS, COMPLETED, or EXPIRED'
        );
      }
    });

    it('should preserve all timestamps correctly', () => {
      const result = mapRowToQuizState(validSnapshot);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startedAt).toEqual(validSnapshot.startedAt);
        expect(result.data.expiresAt).toEqual(validSnapshot.expiresAt);
        expect(result.data.updatedAt).toEqual(validSnapshot.updatedAt);
      }
    });

    it('should handle invalid date formats in answers gracefully', () => {
      const snapshotWithInvalidDates = {
        ...validSnapshot,
        answers: {
          'q1-uuid': {
            answerId: 'ans1',
            questionId: 'q1-uuid',
            selectedOptions: ['opt1'],
            submittedAt: 'invalid-date-string',
          },
          'q2-uuid': {
            answerId: 'ans2',
            questionId: 'q2-uuid',
            selectedOptions: ['opt2'],
            submittedAt: 'not-a-date',
          },
          'q3-uuid': {
            answerId: 'ans3',
            questionId: 'q3-uuid',
            selectedOptions: ['opt3'],
            submittedAt: '1999-01-01T00:00:00Z', // Too old (before 2000)
          },
        },
      };

      const result = mapRowToQuizState(snapshotWithInvalidDates);

      expect(result.success).toBe(true);
      if (result.success) {
        // All invalid dates should be converted to undefined
        expect(result.data.answers['q1-uuid'].submittedAt).toBeUndefined();
        expect(result.data.answers['q2-uuid'].submittedAt).toBeUndefined();
        expect(result.data.answers['q3-uuid'].submittedAt).toBeUndefined();

        // Other properties should remain intact
        expect(result.data.answers['q1-uuid'].answerId).toBe('ans1');
        expect(result.data.answers['q2-uuid'].answerId).toBe('ans2');
        expect(result.data.answers['q3-uuid'].answerId).toBe('ans3');
      }
    });
  });
});

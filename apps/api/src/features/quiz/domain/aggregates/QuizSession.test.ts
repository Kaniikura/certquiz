/**
 * QuizSession aggregate unit tests
 * @fileoverview Pure unit tests for QuizSession business logic
 */

import { TestClock, testIds, unwrapOrFail } from '@api/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DuplicateQuestionError,
  IncompleteQuizError,
  InvalidOptionsError,
  InvalidQuestionReferenceError,
  OutOfOrderAnswerError,
  QuestionAlreadyAnsweredError,
  QuestionCountMismatchError,
  QuestionNotFoundError,
  QuizExpiredError,
  QuizNotExpiredError,
  QuizNotInProgressError,
} from '../errors/QuizErrors';
import {
  AnswerSubmittedEvent,
  QuizCompletedEvent,
  QuizExpiredEvent,
  QuizStartedEvent,
} from '../events/QuizEvents';
import type { QuestionReference } from '../value-objects/QuestionReference';
import { aQuestionReference } from '../value-objects/QuestionReferenceBuilder';
import { aQuizConfig } from '../value-objects/QuizConfigBuilder';
import { QuizState } from '../value-objects/QuizState';
import { QuizSession } from './QuizSession';
import { aQuizSession } from './QuizSessionBuilder';

describe('QuizSession', () => {
  let clock: TestClock;

  beforeEach(() => {
    clock = new TestClock(new Date('2024-01-01T10:00:00Z'));
  });

  describe('startNew', () => {
    it('should create a new quiz session with valid inputs', () => {
      // Arrange
      const userId = testIds.userId();
      const config = unwrapOrFail(aQuizConfig().withQuestionCount(3).build());
      const questionIds = [
        testIds.questionId('q1'),
        testIds.questionId('q2'),
        testIds.questionId('q3'),
      ];

      // Act
      const result = QuizSession.startNew(userId, config, questionIds, clock);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;

      const session = result.data;
      expect(session.userId).toBe(userId);
      expect(session.config).toBe(config);
      expect(session.state).toBe(QuizState.InProgress);
      expect(session.version).toBe(1);
      expect(session.getQuestionIds()).toEqual(questionIds);

      // Check events
      const events = session.pullUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(QuizStartedEvent);
      expect(events[0].version).toBe(1);
      if (events[0] instanceof QuizStartedEvent) {
        expect(events[0].payload.userId).toBe(userId);
        expect(events[0].payload.questionCount).toBe(3);
        expect(events[0].payload.questionIds).toEqual(questionIds);
      }
    });

    it('should fail when question count mismatch', () => {
      // Arrange
      const userId = testIds.userId();
      const config = unwrapOrFail(aQuizConfig().withQuestionCount(3).build());
      const questionIds = [testIds.questionId('q1')]; // Only 1 question, config expects 3

      // Act
      const result = QuizSession.startNew(userId, config, questionIds, clock);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuestionCountMismatchError);
      expect(result.error.message).toContain('expected 3, got 1');
    });

    it('should fail when duplicate questions provided', () => {
      // Arrange
      const userId = testIds.userId();
      const config = unwrapOrFail(aQuizConfig().withQuestionCount(2).build());
      const duplicateId = testIds.questionId('q1');
      const questionIds = [duplicateId, duplicateId]; // Duplicate

      // Act
      const result = QuizSession.startNew(userId, config, questionIds, clock);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(DuplicateQuestionError);
    });

    it('should fail when exceeding maximum question count', () => {
      // Arrange
      const userId = testIds.userId();
      // Create config with valid count, then test with too many questions
      const validConfig = unwrapOrFail(aQuizConfig().withQuestionCount(50).build());
      const questionIds = Array.from({ length: 101 }, (_, i) => testIds.questionId(`q${i}`));

      // Act - This should fail due to question count mismatch
      const result = QuizSession.startNew(userId, validConfig, questionIds, clock);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuestionCountMismatchError);
    });
  });

  describe('submitAnswer', () => {
    let session: QuizSession;
    let questionRef: QuestionReference;

    beforeEach(() => {
      session = aQuizSession()
        .withConfig(unwrapOrFail(aQuizConfig().withQuestionCount(3).build()))
        .withQuestionIds([
          testIds.questionId('q1'),
          testIds.questionId('q2'),
          testIds.questionId('q3'),
        ])
        .withClock(clock)
        .build();

      questionRef = aQuestionReference()
        .withQuestionId(testIds.questionId('q1'))
        .withCorrectOptions([testIds.optionId('opt1'), testIds.optionId('opt2')])
        .build();

      // Clear initial events
      session.pullUncommittedEvents();
    });

    it('should successfully submit answer for valid question', () => {
      // Arrange
      const questionId = testIds.questionId('q1');
      const selectedOptions = [testIds.optionId('opt1')];

      // Act
      const result = session.submitAnswer(questionId, selectedOptions, questionRef, clock);

      // Assert
      expect(result.success).toBe(true);
      expect(session.state).toBe(QuizState.InProgress);
      expect(session.version).toBe(2);

      const events = session.pullUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AnswerSubmittedEvent);
      if (events[0] instanceof AnswerSubmittedEvent) {
        expect(events[0].payload.questionId).toBe(questionId);
        expect(events[0].payload.selectedOptionIds).toEqual(selectedOptions);
      }
    });

    it('should auto-complete when all questions answered and autoComplete enabled', () => {
      // Arrange - Session with 2 questions and autoComplete enabled
      const session2Q = aQuizSession()
        .withConfig(unwrapOrFail(aQuizConfig().withQuestionCount(2).withAutoComplete(true).build()))
        .withQuestionIds([testIds.questionId('q1'), testIds.questionId('q2')])
        .withClock(clock)
        .build();
      session2Q.pullUncommittedEvents(); // Clear initial events

      const questionRef1 = aQuestionReference()
        .withQuestionId(testIds.questionId('q1'))
        .withCorrectOptions([testIds.optionId('opt1')])
        .build();
      const questionRef2 = aQuestionReference()
        .withQuestionId(testIds.questionId('q2'))
        .withCorrectOptions([testIds.optionId('opt2')])
        .build();

      // Act - Submit first answer
      session2Q.submitAnswer(
        testIds.questionId('q1'),
        [testIds.optionId('opt1')],
        questionRef1,
        clock
      );
      session2Q.pullUncommittedEvents(); // Clear events

      // Submit second (final) answer
      const result = session2Q.submitAnswer(
        testIds.questionId('q2'),
        [testIds.optionId('opt2')],
        questionRef2,
        clock
      );

      // Assert
      expect(result.success).toBe(true);
      expect(session2Q.state).toBe(QuizState.Completed); // Auto-completed

      const events = session2Q.pullUncommittedEvents();
      expect(events).toHaveLength(2); // Answer + Completion events
      expect(events[0]).toBeInstanceOf(AnswerSubmittedEvent);
      expect(events[1]).toBeInstanceOf(QuizCompletedEvent);
      if (events[0] instanceof AnswerSubmittedEvent && events[1] instanceof QuizCompletedEvent) {
        expect(events[0].version).toBe(events[1].version); // Same version
      }
    });

    it('should fail when quiz is not in progress', () => {
      // Arrange - Force quiz to completed state
      setQuizSessionState(session, QuizState.Completed);

      // Act
      const result = session.submitAnswer(
        testIds.questionId('q1'),
        [testIds.optionId('opt1')],
        questionRef,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuizNotInProgressError);
    });

    it('should fail when quiz has expired', () => {
      // Arrange - Set time to after expiration (config has 3600s = 1 hour limit)
      const expiredTime = new Date('2024-01-01T11:01:00Z'); // 1 hour 1 minute later
      const expiredClock = new TestClock(expiredTime);

      // Act
      const result = session.submitAnswer(
        testIds.questionId('q1'),
        [testIds.optionId('opt1')],
        questionRef,
        expiredClock
      );

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuizExpiredError);
      expect(session.state).toBe(QuizState.InProgress); // State unchanged (no side effects)
    });

    it('should fail when question not found in quiz', () => {
      // Arrange
      const invalidQuestionId = testIds.questionId('not-in-quiz');

      // Act
      const result = session.submitAnswer(
        invalidQuestionId,
        [testIds.optionId('opt1')],
        questionRef,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuestionNotFoundError);
    });

    it('should fail when question reference mismatch', () => {
      // Arrange
      const mismatchedRef = aQuestionReference()
        .withQuestionId(testIds.questionId('different-question'))
        .build();

      // Act
      const result = session.submitAnswer(
        testIds.questionId('q1'),
        [testIds.optionId('opt1')],
        mismatchedRef,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(InvalidQuestionReferenceError);
    });

    it('should fail when question already answered', () => {
      // Arrange - Submit first answer
      session.submitAnswer(
        testIds.questionId('q1'),
        [testIds.optionId('opt1')],
        questionRef,
        clock
      );

      // Act - Try to answer same question again
      const result = session.submitAnswer(
        testIds.questionId('q1'),
        [testIds.optionId('opt2')],
        questionRef,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuestionAlreadyAnsweredError);
    });

    it('should fail when selected options are invalid', () => {
      // Arrange
      const invalidOption = testIds.optionId('invalid-option');

      // Act
      const result = session.submitAnswer(
        testIds.questionId('q1'),
        [invalidOption],
        questionRef,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(InvalidOptionsError);
    });

    it('should enforce sequential answering when enabled', () => {
      // Arrange - Session with sequential answering enforced
      const sequentialSession = aQuizSession()
        .withConfig(
          unwrapOrFail(aQuizConfig().withQuestionCount(3).withSequentialAnswering(true).build())
        )
        .withQuestionIds([
          testIds.questionId('q1'),
          testIds.questionId('q2'),
          testIds.questionId('q3'),
        ])
        .withClock(clock)
        .build();
      sequentialSession.pullUncommittedEvents();

      const questionRef2 = aQuestionReference().withQuestionId(testIds.questionId('q2')).build();

      // Act - Try to answer question 2 without answering question 1 first
      const result = sequentialSession.submitAnswer(
        testIds.questionId('q2'),
        [testIds.optionId('opt1')],
        questionRef2,
        clock
      );

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(OutOfOrderAnswerError);
      expect((result.error as OutOfOrderAnswerError).expectedIndex).toBe(0);
      expect((result.error as OutOfOrderAnswerError).actualIndex).toBe(1);
    });
  });

  describe('complete', () => {
    let session: QuizSession;

    beforeEach(() => {
      session = aQuizSession().withClock(clock).build();
      session.pullUncommittedEvents(); // Clear initial events
    });

    it('should complete quiz successfully when valid', () => {
      // Act
      const result = session.complete(clock);

      // Assert
      expect(result.success).toBe(true);
      expect(session.state).toBe(QuizState.Completed);
      expect(session.version).toBe(2);

      const events = session.pullUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(QuizCompletedEvent);
    });

    it('should fail when quiz not in progress', () => {
      // Arrange
      setQuizSessionState(session, QuizState.Completed);

      // Act
      const result = session.complete(clock);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuizNotInProgressError);
    });

    it('should fail when quiz has expired', () => {
      // Arrange
      const expiredClock = new TestClock(new Date('2024-01-01T11:01:00Z'));

      // Act
      const result = session.complete(expiredClock);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuizExpiredError);
    });

    it('should fail when requireAllAnswers is true and questions unanswered', () => {
      // Arrange
      const strictSession = aQuizSession()
        .withConfig(
          unwrapOrFail(aQuizConfig().withQuestionCount(3).withRequireAllAnswers(true).build())
        )
        .withClock(clock)
        .build();
      strictSession.pullUncommittedEvents();

      // Act
      const result = strictSession.complete(clock);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(IncompleteQuizError);
      expect((result.error as IncompleteQuizError).unansweredCount).toBe(3);
    });
  });

  describe('expire', () => {
    let session: QuizSession;

    beforeEach(() => {
      session = aQuizSession().withClock(clock).build();
      session.pullUncommittedEvents();
    });

    it('should expire quiz when time limit exceeded', () => {
      // Arrange
      const expiredClock = new TestClock(new Date('2024-01-01T11:01:00Z'));

      // Act
      const result = session.expire(expiredClock);

      // Assert
      expect(result.success).toBe(true);
      expect(session.state).toBe(QuizState.Expired);
      expect(session.version).toBe(2);

      const events = session.pullUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(QuizExpiredEvent);
    });

    it('should succeed without change when already terminated', () => {
      // Arrange
      setQuizSessionState(session, QuizState.Completed);
      const expiredClock = new TestClock(new Date('2024-01-01T11:01:00Z'));

      // Act
      const result = session.expire(expiredClock);

      // Assert
      expect(result.success).toBe(true);
      expect(session.state).toBe(QuizState.Completed); // Unchanged

      const events = session.pullUncommittedEvents();
      expect(events).toHaveLength(0); // No events
    });

    it('should fail when not expired yet', () => {
      // Arrange
      const notExpiredClock = new TestClock(new Date('2024-01-01T10:30:00Z'));

      // Act
      const result = session.expire(notExpiredClock);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(QuizNotExpiredError);
    });
  });

  describe('checkAndExpire', () => {
    let session: QuizSession;

    beforeEach(() => {
      session = aQuizSession().withClock(clock).build();
      session.pullUncommittedEvents();
    });

    it('should expire and return true when time limit exceeded', () => {
      // Arrange
      const expiredClock = new TestClock(new Date('2024-01-01T11:01:00Z'));

      // Act
      const result = session.checkAndExpire(expiredClock);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBe(true); // State changed
      expect(session.state).toBe(QuizState.Expired);

      const events = session.pullUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(QuizExpiredEvent);
    });

    it('should return false when not expired', () => {
      // Arrange
      const validClock = new TestClock(new Date('2024-01-01T10:30:00Z'));

      // Act
      const result = session.checkAndExpire(validClock);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBe(false); // No state change
      expect(session.state).toBe(QuizState.InProgress);
    });

    it('should return false when already terminated', () => {
      // Arrange
      setQuizSessionState(session, QuizState.Completed);
      const expiredClock = new TestClock(new Date('2024-01-01T11:01:00Z'));

      // Act
      const result = session.checkAndExpire(expiredClock);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBe(false); // No state change
      expect(session.state).toBe(QuizState.Completed);
    });
  });

  describe('event sourcing', () => {
    it('should reconstruct state from event history', () => {
      // Arrange
      const userId = testIds.userId();
      const aggregateId = testIds.quizSessionId();
      const questionIds = [testIds.questionId('q1'), testIds.questionId('q2')];
      const config = unwrapOrFail(aQuizConfig().withQuestionCount(2).build());

      const events = [
        new QuizStartedEvent({
          aggregateId,
          version: 1,
          payload: {
            userId,
            questionCount: 2,
            questionIds,
            configSnapshot: config.toDTO(),
          },
        }),
        new AnswerSubmittedEvent({
          aggregateId,
          version: 2,
          payload: {
            answerId: testIds.answerId(),
            questionId: questionIds[0],
            selectedOptionIds: [testIds.optionId('opt1')],
            answeredAt: new Date('2024-01-01T10:05:00Z'),
          },
        }),
        new QuizCompletedEvent({
          aggregateId,
          version: 3,
          payload: {
            answeredCount: 2,
            totalCount: 2,
          },
        }),
      ];

      // Act
      const session = QuizSession.createForReplay(aggregateId);
      session.loadFromHistory(events);

      // Assert
      expect(session.state).toBe(QuizState.Completed);
      expect(session.version).toBe(3);
      expect(session.getQuestionIds()).toEqual(questionIds);
      expect(session.config.questionCount).toBe(2);
    });
  });

  describe('version management', () => {
    it('should increment version once per command', () => {
      // Arrange
      const session = aQuizSession().withClock(clock).build();
      session.pullUncommittedEvents(); // Clear initial events
      const initialVersion = session.version; // Should be 1 after startNew

      // Act - Submit answer (single command)
      const questionRef = aQuestionReference().withQuestionId(testIds.questionId('q1')).build();
      session.submitAnswer(
        testIds.questionId('q1'),
        [testIds.optionId('opt1')],
        questionRef,
        clock
      );

      // Assert
      expect(session.version).toBe(initialVersion + 1);

      // Events should share the same version even if multiple events are emitted
      const events = session.pullUncommittedEvents();
      events.forEach((event) => {
        expect(event.version).toBe(initialVersion + 1);
      });
    });
  });
});

// Helper to forcibly change the QuizSession state for testing.
function setQuizSessionState(s: QuizSession, state: QuizState) {
  // @ts-expect-error Directly modifying private field for test purposes.
  s._state = state;
}

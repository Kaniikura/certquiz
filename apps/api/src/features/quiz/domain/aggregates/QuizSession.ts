/**
 * QuizSession aggregate root
 * @fileoverview Main aggregate for quiz domain with business logic and invariants
 */

import { Result } from '@api/shared/result';
import { AggregateRoot } from '../base/AggregateRoot';
import type { Clock } from '../base/Clock';
import { Answer } from '../entities/Answer';
import {
  DuplicateQuestionError,
  IncompleteQuizError,
  InvalidOptionsError,
  InvalidQuestionCountError,
  InvalidQuestionReferenceError,
  OutOfOrderAnswerError,
  QuestionAlreadyAnsweredError,
  QuestionCountMismatchError,
  QuestionNotFoundError,
  type QuizDomainError,
  QuizExpiredError,
  QuizNotExpiredError,
  QuizNotInProgressError,
} from '../errors/QuizErrors';
import type { DomainEvent } from '../events/DomainEvent';
import {
  AnswerSubmittedEvent,
  type AnswerSubmittedPayload,
  QuizCompletedEvent,
  type QuizCompletedPayload,
  QuizExpiredEvent,
  type QuizExpiredPayload,
  QuizStartedEvent,
  type QuizStartedPayload,
} from '../events/QuizEvents';
import { type OptionId, type QuestionId, QuizSessionId, type UserId } from '../value-objects/Ids';
import { QuestionOrder } from '../value-objects/QuestionOrder';
import type { QuestionReference } from '../value-objects/QuestionReference';
import { QuizConfig } from '../value-objects/QuizConfig';
import { QuizState } from '../value-objects/QuizState';

type QuizEventPayloads =
  | QuizStartedPayload
  | AnswerSubmittedPayload
  | QuizCompletedPayload
  | QuizExpiredPayload;

export class QuizSession extends AggregateRoot<QuizSessionId, QuizEventPayloads> {
  private _questionOrder: QuestionOrder;
  private readonly _answers: Map<QuestionId, Answer>;
  private _startedAt: Date;
  private _state: QuizState;
  private _completedAt?: Date;

  private _userId!: UserId;

  public get userId(): UserId {
    return this._userId;
  }
  private _config: QuizConfig;

  get config(): QuizConfig {
    return this._config;
  }

  get state(): QuizState {
    return this._state;
  }

  get startedAt(): Date {
    return new Date(this._startedAt.getTime());
  }

  get completedAt(): Date | undefined {
    return this._completedAt ? new Date(this._completedAt.getTime()) : undefined;
  }

  /**
   * Static factory for new sessions
   */
  static startNew(
    userId: UserId,
    config: QuizConfig,
    questionIds: QuestionId[],
    clock: Clock
  ): Result<QuizSession, QuizDomainError> {
    // Validate invariants
    if (questionIds.length !== config.questionCount) {
      return Result.fail(new QuestionCountMismatchError(config.questionCount, questionIds.length));
    }

    // Check for duplicates
    const uniqueIds = new Set(questionIds);
    if (uniqueIds.size !== questionIds.length) {
      return Result.fail(new DuplicateQuestionError());
    }

    // Enforce maximum size limit
    if (questionIds.length > QuizConfig.MAX_QUESTION_COUNT) {
      return Result.fail(
        new InvalidQuestionCountError(
          `Question count exceeds maximum limit of ${QuizConfig.MAX_QUESTION_COUNT}`
        )
      );
    }

    // Build question order value object for persistence
    const questionOrder = QuestionOrder.create(questionIds);

    const session = new QuizSession(
      QuizSessionId.generate(),
      userId,
      config,
      questionOrder,
      clock.now()
    );

    // Raise event with single version increment
    const version = session.incrementVersion();
    const event = new QuizStartedEvent({
      aggregateId: session.id,
      version,
      payload: {
        userId: userId,
        questionCount: questionIds.length,
        questionIds: questionIds,
        configSnapshot: config.toDTO(),
      },
    });
    session.addEvent(event);

    return Result.ok(session);
  }

  submitAnswer(
    questionId: QuestionId,
    selectedOptionIds: OptionId[],
    questionRef: QuestionReference,
    clock: Clock
  ): Result<void, QuizDomainError> {
    // Check state invariants
    if (this._state !== QuizState.InProgress) {
      return Result.fail(new QuizNotInProgressError());
    }

    // Check time limit - fail without side effects
    if (this.isExpired(clock.now())) {
      return Result.fail(new QuizExpiredError());
    }

    // Validate question belongs to quiz
    if (!this._questionOrder.has(questionId)) {
      return Result.fail(new QuestionNotFoundError());
    }

    // Validate QuestionReference matches the questionId
    if (questionRef.id !== questionId) {
      return Result.fail(new InvalidQuestionReferenceError());
    }

    // Prevent duplicate answers
    if (this._answers.has(questionId)) {
      return Result.fail(new QuestionAlreadyAnsweredError());
    }

    // Validate selected options belong to the question
    const invalidOptions = selectedOptionIds.filter((optionId) => !questionRef.hasOption(optionId));
    if (invalidOptions.length > 0) {
      return Result.fail(new InvalidOptionsError(invalidOptions.map((id) => id.toString())));
    }

    // Check sequential ordering if required
    if (this.config.enforceSequentialAnswering) {
      const expectedIndex = this._answers.size;
      const questionIndex = this.getQuestionIndex(questionId);
      if (questionIndex === -1) {
        // This should never happen as we already validated above, but adding safety check
        return Result.fail(new QuestionNotFoundError());
      }
      if (questionIndex !== expectedIndex) {
        return Result.fail(new OutOfOrderAnswerError(expectedIndex, questionIndex));
      }
    }

    // Create answer with validation
    const answerResult = Answer.create(questionId, selectedOptionIds, clock.now());
    if (!answerResult.success) {
      // Propagate the specific error from Answer.create
      return Result.fail(answerResult.error as QuizDomainError);
    }
    this._answers.set(questionId, answerResult.data);

    // Auto-complete if all answered and autoCompleteWhenAllAnswered is enabled
    if (
      this.config.autoCompleteWhenAllAnswered &&
      this._answers.size === this._questionOrder.size
    ) {
      this._state = QuizState.Completed;
      this._completedAt = clock.now();
    }

    // Raise events with single version increment
    const version = this.incrementVersion();
    const answerEvent = new AnswerSubmittedEvent({
      aggregateId: this.id,
      version,
      payload: {
        answerId: answerResult.data.id,
        questionId: questionId,
        selectedOptionIds,
        answeredAt: answerResult.data.answeredAt,
      },
    });
    this.addEvent(answerEvent);

    if (this._state === QuizState.Completed) {
      const completedEvent = new QuizCompletedEvent({
        aggregateId: this.id,
        version, // Same version as answer event
        payload: {
          answeredCount: this._answers.size,
          totalCount: this._questionOrder.size,
        },
      });
      this.addEvent(completedEvent);
    }

    return Result.ok();
  }

  complete(clock: Clock): Result<void, QuizDomainError> {
    if (this._state !== QuizState.InProgress) {
      return Result.fail(new QuizNotInProgressError());
    }

    // Check time limit - fail without side effects
    if (this.isExpired(clock.now())) {
      return Result.fail(new QuizExpiredError());
    }

    // Check requireAllAnswers constraint
    if (this.config.requireAllAnswers) {
      const unanswered = this._questionOrder.size - this._answers.size;
      if (unanswered > 0) {
        return Result.fail(new IncompleteQuizError(unanswered));
      }
    }

    this._state = QuizState.Completed;
    this._completedAt = clock.now();

    const version = this.incrementVersion();
    const event = new QuizCompletedEvent({
      aggregateId: this.id,
      version,
      payload: {
        answeredCount: this._answers.size,
        totalCount: this._questionOrder.size,
      },
    });
    this.addEvent(event);

    return Result.ok();
  }

  /**
   * Expire command for scheduled jobs or self-healing
   */
  expire(clock: Clock): Result<void> {
    if (this._state !== QuizState.InProgress) {
      return Result.ok(); // Already terminated
    }

    if (!this.isExpired(clock.now())) {
      return Result.fail(new QuizNotExpiredError());
    }

    this.performExpiration(clock);
    return Result.ok();
  }

  /**
   * Check and expire if time limit exceeded - explicit state change
   */
  checkAndExpire(clock: Clock): Result<boolean> {
    if (this._state !== QuizState.InProgress) {
      return Result.ok(false); // Already terminated
    }

    if (!this.isExpired(clock.now())) {
      return Result.ok(false); // Not expired
    }

    this.performExpiration(clock);
    return Result.ok(true); // State changed to expired
  }

  /**
   * Private helper to consolidate expiration logic
   */
  private performExpiration(clock: Clock): void {
    const now = clock.now();
    this._state = QuizState.Expired;
    this._completedAt = now;

    const version = this.incrementVersion();
    const event = new QuizExpiredEvent({
      aggregateId: this.id,
      version,
      payload: { expiredAt: now },
    });
    this.addEvent(event);
  }

  /**
   * Private helper to get question index - O(1) lookup
   */
  private getQuestionIndex(questionId: QuestionId): number {
    return this._questionOrder.getIndex(questionId);
  }

  /**
   * Event sourcing reconstruction
   */
  protected apply(event: DomainEvent<QuizSessionId, QuizEventPayloads>): void {
    switch (event.eventType) {
      case 'quiz.started': {
        const startPayload = event.payload as QuizStartedPayload;
        // Reconstruct internal state from event
        this._userId = startPayload.userId;
        this._questionOrder = QuestionOrder.fromPersistence(startPayload.questionIds);
        this._config = QuizConfig.fromDTO(startPayload.configSnapshot);
        this._startedAt = event.occurredAt;
        this._state = QuizState.InProgress;
        // Note: _startedAt is only set here and never overwritten by other events
        break;
      }

      case 'quiz.answer_submitted': {
        const answerPayload = event.payload as AnswerSubmittedPayload;
        this._answers.set(
          answerPayload.questionId,
          Answer.fromEventReplay(
            answerPayload.answerId,
            answerPayload.questionId,
            answerPayload.selectedOptionIds,
            answerPayload.answeredAt
          )
        );

        // Re-evaluate auto-complete during replay
        if (
          this._config.autoCompleteWhenAllAnswered &&
          this._answers.size === this._questionOrder.size
        ) {
          this._state = QuizState.Completed;
          this._completedAt = event.occurredAt;
        }
        break;
      }

      case 'quiz.completed': {
        this._state = QuizState.Completed;
        this._completedAt = event.occurredAt;
        break;
      }

      case 'quiz.expired': {
        this._state = QuizState.Expired;
        this._completedAt = event.occurredAt;
        break;
      }
    }
  }

  /**
   * Check expiry
   */
  private isExpired(now: Date): boolean {
    const elapsed = now.getTime() - this._startedAt.getTime();

    if (this.config.timeLimit) {
      return elapsed >= this.config.timeLimit * 1000; // >= for explicit boundary handling
    }

    // Use configured fallback limit for sessions without explicit time limit
    return elapsed >= this.config.fallbackLimitSeconds * 1000;
  }

  /**
   * Public getter for question IDs (used by application services)
   */
  getQuestionIds(): QuestionId[] {
    return this._questionOrder.getAllIds();
  }

  /**
   * Private constructor enforces factory method usage
   */
  private constructor(
    id: QuizSessionId,
    userId: UserId,
    config: QuizConfig,
    questionOrder: QuestionOrder,
    startedAt: Date
  ) {
    super(id);
    this._userId = userId;
    this._config = config;
    this._questionOrder = questionOrder;
    this._answers = new Map();
    this._startedAt = startedAt;
    this._state = QuizState.InProgress;
  }

  /**
   * Required for event sourcing reconstruction
   * Creates an uninitialized aggregate that will be populated by replaying events
   *
   * Note: Following event sourcing best practices, this method accepts only the aggregate ID.
   * All other state (userId, config, etc.) is reconstructed by applying domain events during
   * loadFromHistory(). This avoids data duplication and potential inconsistencies between
   * constructor parameters and event payload data.
   */
  static createForReplay(id: QuizSessionId): QuizSession {
    // Create empty instance with only the ID - all other properties will be set by events
    const instance = Object.create(QuizSession.prototype);
    instance.id = id;
    instance._answers = new Map<QuestionId, Answer>();
    instance._uncommittedEvents = [];
    instance._version = 0;
    return instance;
  }
}

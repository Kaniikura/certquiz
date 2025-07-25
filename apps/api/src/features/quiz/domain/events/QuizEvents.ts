/**
 * Quiz domain events
 * @fileoverview Event definitions for quiz bounded context
 */

import type { AnswerId, OptionId, QuestionId, QuizSessionId, UserId } from '../value-objects/Ids';
import type { QuizConfigDTO } from '../value-objects/QuizConfig';
import { DomainEvent } from './DomainEvent';

export interface QuizStartedPayload {
  userId: UserId;
  questionCount: number;
  questionIds: QuestionId[];
  configSnapshot: QuizConfigDTO;
  questionSnapshots?: QuestionSnapshot[];
}

interface QuestionSnapshot {
  id: QuestionId;
  version: number;
  text: string;
  optionIds: OptionId[];
}

export interface AnswerSubmittedPayload {
  answerId: AnswerId;
  questionId: QuestionId;
  selectedOptionIds: OptionId[];
  answeredAt: Date;
}

export interface QuizCompletedPayload {
  answeredCount: number;
  totalCount: number;
}

export interface QuizExpiredPayload {
  expiredAt: Date;
}

// Concrete event classes
export class QuizStartedEvent extends DomainEvent<QuizSessionId, QuizStartedPayload> {
  constructor(props: {
    aggregateId: QuizSessionId;
    version: number;
    payload: QuizStartedPayload;
    eventId?: string;
    occurredAt?: Date;
  }) {
    super({ ...props, eventType: 'quiz.started' });
  }
}

export class AnswerSubmittedEvent extends DomainEvent<QuizSessionId, AnswerSubmittedPayload> {
  constructor(props: {
    aggregateId: QuizSessionId;
    version: number;
    payload: AnswerSubmittedPayload;
    eventId?: string;
    occurredAt?: Date;
  }) {
    super({ ...props, eventType: 'quiz.answer_submitted' });
  }
}

export class QuizCompletedEvent extends DomainEvent<QuizSessionId, QuizCompletedPayload> {
  constructor(props: {
    aggregateId: QuizSessionId;
    version: number;
    payload: QuizCompletedPayload;
    eventId?: string;
    occurredAt?: Date;
  }) {
    super({ ...props, eventType: 'quiz.completed' });
  }
}

export class QuizExpiredEvent extends DomainEvent<QuizSessionId, QuizExpiredPayload> {
  constructor(props: {
    aggregateId: QuizSessionId;
    version: number;
    payload: QuizExpiredPayload;
    eventId?: string;
    occurredAt?: Date;
  }) {
    super({ ...props, eventType: 'quiz.expired' });
  }
}

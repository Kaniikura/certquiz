/**
 * Quiz domain exports
 * @fileoverview Main entry point for quiz domain layer
 */

// Base infrastructure
export type { Clock } from '@api/shared/clock';
export { SystemClock } from '@api/shared/clock';
// Errors
export { QuizDomainError } from '../shared/errors';
// Aggregates
export { QuizSession } from './aggregates/QuizSession';
export { AggregateRoot } from './base/AggregateRoot';
// Entities
export { Answer } from './entities/Answer';
export { DomainEvent } from './events/DomainEvent';
export { DrizzleQuizRepository } from './repositories/DrizzleQuizRepository';
// Repositories
export type { IQuizRepository } from './repositories/IQuizRepository';
export type { Category, Difficulty, ExamType } from './value-objects/ExamTypes';
// Value Objects
export { type OptionId, QuestionId, QuizSessionId, type UserId } from './value-objects/Ids';
export { QuestionOrder } from './value-objects/QuestionOrder';
export { QuestionReference } from './value-objects/QuestionReference';
export { QuizConfig } from './value-objects/QuizConfig';
export { QuizState } from './value-objects/QuizState';

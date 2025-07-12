/**
 * Branded types for type safety with factory functions for proper type creation
 * @fileoverview Type-safe ID system for Quiz domain
 */

// Branded types with factory functions for proper type safety
export type QuestionId = string & { readonly __brand: 'QuestionId' };
export type OptionId = string & { readonly __brand: 'OptionId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type QuizSessionId = string & { readonly __brand: 'QuizSessionId' };
export type AnswerId = string & { readonly __brand: 'AnswerId' };

// ID Generation using crypto.randomUUID()
function generateId(): string {
  return crypto.randomUUID();
}

// Factory functions ensure proper type creation
export const QuestionId = {
  of: (value: string): QuestionId => value as QuestionId,
  generate: (): QuestionId => generateId() as QuestionId,
  equals: (a: QuestionId, b: QuestionId): boolean => a === b,
  toString: (id: QuestionId): string => id,
};

export const OptionId = {
  of: (value: string): OptionId => value as OptionId,
  generate: (): OptionId => generateId() as OptionId,
  equals: (a: OptionId, b: OptionId): boolean => a === b,
  toString: (id: OptionId): string => id,
};

export const UserId = {
  of: (value: string): UserId => value as UserId,
  generate: (): UserId => generateId() as UserId,
  equals: (a: UserId, b: UserId): boolean => a === b,
  toString: (id: UserId): string => id,
};

export const QuizSessionId = {
  of: (value: string): QuizSessionId => value as QuizSessionId,
  generate: (): QuizSessionId => generateId() as QuizSessionId,
  equals: (a: QuizSessionId, b: QuizSessionId): boolean => a === b,
  toString: (id: QuizSessionId): string => id,
};

export const AnswerId = {
  of: (value: string): AnswerId => value as AnswerId,
  generate: (): AnswerId => generateId() as AnswerId,
  equals: (a: AnswerId, b: AnswerId): boolean => a === b,
  toString: (id: AnswerId): string => id,
};

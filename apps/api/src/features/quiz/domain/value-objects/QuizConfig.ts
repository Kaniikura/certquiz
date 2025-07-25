/**
 * Quiz configuration value object
 * @fileoverview Immutable configuration for quiz sessions
 */

import { Result } from '@api/shared/result';
import { InvalidQuestionCountError, InvalidTimeLimitError } from '../../shared/errors';
import type { Category, Difficulty, ExamType } from './ExamTypes';

// DTO for event storage and serialization
export interface QuizConfigDTO {
  examType: string;
  category: string | null;
  questionCount: number;
  timeLimit: number | null;
  difficulty: string;
  enforceSequentialAnswering: boolean;
  requireAllAnswers: boolean;
  autoCompleteWhenAllAnswered: boolean;
  fallbackLimitSeconds: number;
}

export class QuizConfig {
  static readonly MAX_QUESTION_COUNT = 100;
  static readonly DEFAULT_FALLBACK_LIMIT_SECONDS = 4 * 60 * 60; // 4 hours default

  private constructor(
    public readonly examType: ExamType,
    public readonly category: Category | null,
    public readonly questionCount: number,
    public readonly timeLimit: number | null, // seconds
    public readonly difficulty: Difficulty,
    public readonly enforceSequentialAnswering: boolean,
    public readonly requireAllAnswers: boolean,
    public readonly autoCompleteWhenAllAnswered: boolean,
    public readonly fallbackLimitSeconds: number // Safety net for sessions without time limit
  ) {}

  static create(props: {
    examType: ExamType;
    category?: Category;
    questionCount: number;
    timeLimit?: number;
    difficulty?: Difficulty; // Defaults to Difficulty.Mixed
    enforceSequentialAnswering?: boolean; // Defaults to false
    requireAllAnswers?: boolean; // Defaults to false
    autoCompleteWhenAllAnswered?: boolean; // Defaults to true
    fallbackLimitSeconds?: number; // Defaults to DEFAULT_FALLBACK_LIMIT_SECONDS
  }): Result<QuizConfig> {
    // Validate constraints
    if (props.questionCount < 1 || props.questionCount > QuizConfig.MAX_QUESTION_COUNT) {
      return Result.fail(new InvalidQuestionCountError());
    }

    if (props.timeLimit !== undefined && props.timeLimit < 60) {
      return Result.fail(new InvalidTimeLimitError());
    }

    const fallbackSeconds = props.fallbackLimitSeconds ?? QuizConfig.DEFAULT_FALLBACK_LIMIT_SECONDS;
    if (fallbackSeconds < 60) {
      return Result.fail(new InvalidTimeLimitError());
    }

    return Result.ok(
      new QuizConfig(
        props.examType,
        props.category ?? null,
        props.questionCount,
        props.timeLimit ?? null,
        props.difficulty ?? 'MIXED',
        props.enforceSequentialAnswering ?? false,
        props.requireAllAnswers ?? false,
        props.autoCompleteWhenAllAnswered ?? true,
        fallbackSeconds
      )
    );
  }

  toDTO(): QuizConfigDTO {
    return {
      examType: this.examType,
      category: this.category,
      questionCount: this.questionCount,
      timeLimit: this.timeLimit,
      difficulty: this.difficulty,
      enforceSequentialAnswering: this.enforceSequentialAnswering,
      requireAllAnswers: this.requireAllAnswers,
      autoCompleteWhenAllAnswered: this.autoCompleteWhenAllAnswered,
      fallbackLimitSeconds: this.fallbackLimitSeconds,
    };
  }

  static fromDTO(dto: QuizConfigDTO): QuizConfig {
    return new QuizConfig(
      dto.examType as ExamType,
      dto.category as Category | null,
      dto.questionCount,
      dto.timeLimit,
      dto.difficulty as Difficulty,
      dto.enforceSequentialAnswering,
      dto.requireAllAnswers,
      dto.autoCompleteWhenAllAnswered,
      dto.fallbackLimitSeconds
    );
  }
}

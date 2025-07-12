/**
 * Answer entity (child of QuizSession aggregate)
 * @fileoverview Represents a submitted answer to a quiz question
 */

import { Result } from '@api/shared/result';
import { InvalidAnswerError } from '../errors/QuizErrors';
import { AnswerId, type OptionId, type QuestionId } from '../value-objects/Ids';

export class Answer {
  private constructor(
    public readonly id: AnswerId,
    public readonly questionId: QuestionId,
    public readonly selectedOptionIds: readonly OptionId[],
    public readonly answeredAt: Date
  ) {}

  /**
   * Factory method for safe construction with Result type
   */
  static create(
    questionId: QuestionId,
    selectedOptionIds: OptionId[],
    answeredAt: Date
  ): Result<Answer> {
    // Validate no empty answers
    if (selectedOptionIds.length === 0) {
      return Result.fail(new InvalidAnswerError('Answer must include at least one option'));
    }

    // Validate no duplicates
    const uniqueOptions = new Set(selectedOptionIds);
    if (uniqueOptions.size !== selectedOptionIds.length) {
      return Result.fail(new InvalidAnswerError('Answer contains duplicate option selections'));
    }

    return Result.ok(
      new Answer(AnswerId.generate(), questionId, Object.freeze([...selectedOptionIds]), answeredAt)
    );
  }

  /**
   * Internal factory for event sourcing reconstruction (skip validation)
   */
  static fromEventReplay(
    answerId: AnswerId,
    questionId: QuestionId,
    selectedOptionIds: OptionId[],
    answeredAt: Date
  ): Answer {
    return new Answer(answerId, questionId, Object.freeze([...selectedOptionIds]), answeredAt);
  }
}

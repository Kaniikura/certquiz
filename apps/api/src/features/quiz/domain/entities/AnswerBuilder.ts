/**
 * Test builder for Answer entity
 * @fileoverview Builder pattern for creating test instances
 */

import { testIds } from '@api/test-support';
import type { OptionId, QuestionId } from '../value-objects/Ids';
import { Answer } from './Answer';

export class AnswerBuilder {
  private questionId: QuestionId = testIds.questionId();
  private selectedOptionIds: OptionId[] = [testIds.optionId()];
  private answeredAt: Date = new Date('2024-01-01T10:05:00Z');

  withQuestionId(questionId: QuestionId): this {
    this.questionId = questionId;
    return this;
  }

  withSelectedOptions(optionIds: OptionId[]): this {
    this.selectedOptionIds = optionIds;
    return this;
  }

  withAnsweredAt(date: Date): this {
    this.answeredAt = date;
    return this;
  }

  build(): Answer {
    const result = Answer.create(this.questionId, this.selectedOptionIds, this.answeredAt);
    if (!result.success) {
      throw new Error(`Failed to create test Answer: ${result.error.message}`);
    }
    return result.data;
  }
}

// Factory function for cleaner syntax
export const anAnswer = () => new AnswerBuilder();

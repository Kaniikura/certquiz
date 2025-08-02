/**
 * Test builder for QuestionReference value object
 * @fileoverview Builder pattern for creating test instances
 */

import type { OptionId, QuestionId } from '@api/features/quiz/domain';
import { QuestionReference } from '@api/features/quiz/domain';
import { testIds } from '@api/test-support';

class QuestionReferenceBuilder {
  private questionId: QuestionId = testIds.questionId();
  private correctOptionIds: Set<OptionId> = new Set([
    testIds.optionId('opt1'),
    testIds.optionId('opt2'),
  ]);

  withQuestionId(questionId: QuestionId): this {
    this.questionId = questionId;
    return this;
  }

  withCorrectOptions(optionIds: OptionId[]): this {
    this.correctOptionIds = new Set(optionIds);
    return this;
  }

  build(): QuestionReference {
    return new QuestionReference(this.questionId, this.correctOptionIds);
  }
}

// Factory function for cleaner syntax
export const aQuestionReference = () => new QuestionReferenceBuilder();

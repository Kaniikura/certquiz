/**
 * Question reference value object
 * @fileoverview Read-only reference to question for validation
 */

import type { OptionId, QuestionId } from './Ids';

export class QuestionReference {
  public readonly validOptionIds: ReadonlySet<OptionId>;

  constructor(
    public readonly id: QuestionId,
    validOptionIds: ReadonlySet<OptionId> | OptionId[]
  ) {
    // Defensive copy to prevent external mutation
    this.validOptionIds = Array.isArray(validOptionIds)
      ? new Set(validOptionIds)
      : new Set(validOptionIds);
  }

  hasOption(optionId: OptionId): boolean {
    return this.validOptionIds.has(optionId);
  }
}

/**
 * Question order value object
 * @fileoverview Manages ordered sequence of questions with O(1) lookup
 */

import type { QuestionId } from './Ids';

export class QuestionOrder {
  private readonly _orderMap: Map<QuestionId, number>;
  private readonly _orderedIds: QuestionId[];

  private constructor(questionIds: QuestionId[]) {
    this._orderedIds = [...questionIds];
    this._orderMap = new Map();
    questionIds.forEach((id, index) => {
      this._orderMap.set(id, index);
    });
  }

  static create(questionIds: QuestionId[]): QuestionOrder {
    // Validate non-empty and no duplicates
    if (questionIds.length === 0) {
      throw new Error('Question order cannot be empty');
    }

    const uniqueIds = new Set(questionIds);
    if (uniqueIds.size !== questionIds.length) {
      throw new Error('Question order contains duplicate IDs');
    }

    return new QuestionOrder(questionIds);
  }

  static fromPersistence(questionIds: QuestionId[]): QuestionOrder {
    // Validate integrity of persisted data to prevent invalid state
    if (questionIds.length === 0) {
      throw new Error('Question order cannot be empty');
    }
    const uniqueIds = new Set(questionIds);
    if (uniqueIds.size !== questionIds.length) {
      throw new Error('Question order contains duplicate IDs');
    }
    return new QuestionOrder(questionIds);
  }

  toPersistence(): QuestionId[] {
    return [...this._orderedIds];
  }

  has(questionId: QuestionId): boolean {
    return this._orderMap.has(questionId);
  }

  getIndex(questionId: QuestionId): number {
    return this._orderMap.get(questionId) ?? -1;
  }

  getAllIds(): QuestionId[] {
    return [...this._orderedIds];
  }

  get size(): number {
    return this._orderedIds.length;
  }
}

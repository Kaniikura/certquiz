/**
 * Test builder for QuizSession aggregate
 * @fileoverview Builder pattern for creating test instances
 */

import { TestClock, testIds } from '@api/test-support';
import type { QuestionId, UserId } from '../value-objects/Ids';
import { QuizConfig } from '../value-objects/QuizConfig';
import { QuizSession } from './QuizSession';

interface QuizSessionBuilderProps {
  userId?: UserId;
  config?: QuizConfig;
  questionIds?: QuestionId[];
  clock?: TestClock;
}

export class QuizSessionBuilder {
  private props: QuizSessionBuilderProps = {};

  withUserId(userId: UserId): this {
    this.props.userId = userId;
    return this;
  }

  withConfig(config: QuizConfig): this {
    this.props.config = config;
    return this;
  }

  withQuestionIds(questionIds: QuestionId[]): this {
    this.props.questionIds = questionIds;
    return this;
  }

  withClock(clock: TestClock): this {
    this.props.clock = clock;
    return this;
  }

  build(): QuizSession {
    const userId = this.props.userId ?? testIds.userId();
    const config = this.props.config ?? createDefaultQuizConfig();
    const clock = this.props.clock ?? new TestClock();

    // Ensure questionIds match config.questionCount
    const questionIds = this.props.questionIds ?? testIds.questionIds(config.questionCount);

    if (questionIds.length !== config.questionCount) {
      // Adjust to match config
      const adjustedIds = questionIds.slice(0, config.questionCount);
      while (adjustedIds.length < config.questionCount) {
        adjustedIds.push(testIds.questionId(`q${adjustedIds.length + 1}`));
      }
      this.props.questionIds = adjustedIds;
    }

    const questionIdsToUse = this.props.questionIds || testIds.questionIds(config.questionCount);

    const result = QuizSession.startNew(userId, config, questionIdsToUse, clock);

    if (!result.success) {
      throw new Error(`Failed to create test QuizSession: ${result.error.message}`);
    }

    return result.data;
  }
}

// Helper to create default config
function createDefaultQuizConfig(): QuizConfig {
  const result = QuizConfig.create({
    examType: 'CCNA',
    questionCount: 3,
    timeLimit: 3600,
    difficulty: 'MIXED',
  });

  if (!result.success) {
    throw new Error('Failed to create default QuizConfig');
  }

  return result.data;
}

// Factory function for cleaner syntax
export const aQuizSession = () => new QuizSessionBuilder();

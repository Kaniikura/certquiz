/**
 * Test builder for QuizSession aggregate
 * @fileoverview Builder pattern for creating test instances
 */

import { TestClock, testIds } from '@api/test-support';
import { QuizSession } from '../../features/quiz/domain/aggregates/QuizSession';
import type { QuestionId, UserId } from '../../features/quiz/domain/value-objects/Ids';
import { QuizConfig } from '../../features/quiz/domain/value-objects/QuizConfig';

interface QuizSessionBuilderProps {
  userId?: UserId;
  config?: QuizConfig;
  questionIds?: QuestionId[];
  clock?: TestClock;
}

class QuizSessionBuilder {
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

    // Determine questionIds without side effects
    let questionIdsToUse = this.props.questionIds;
    if (questionIdsToUse === undefined) {
      // If no IDs are provided, generate them based on the config.
      questionIdsToUse = testIds.questionIds(config.questionCount);
    } else if (questionIdsToUse.length !== config.questionCount) {
      // If provided IDs don't match the count, adjust them.
      const adjustedIds = questionIdsToUse.slice(0, config.questionCount);
      while (adjustedIds.length < config.questionCount) {
        adjustedIds.push(testIds.questionId(`q${adjustedIds.length + 1}`));
      }
      questionIdsToUse = adjustedIds;
    }

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

/**
 * Test builder for QuizConfig value object
 * @fileoverview Builder pattern for creating test instances
 */

import type { Category, Difficulty, ExamType } from './ExamTypes';
import { QuizConfig } from './QuizConfig';

interface QuizConfigBuilderProps {
  examType?: ExamType;
  category?: Category;
  questionCount?: number;
  timeLimit?: number;
  difficulty?: Difficulty;
  enforceSequentialAnswering?: boolean;
  requireAllAnswers?: boolean;
  autoCompleteWhenAllAnswered?: boolean;
  fallbackLimitSeconds?: number;
}

export class QuizConfigBuilder {
  private props: QuizConfigBuilderProps = {
    examType: 'CCNA',
    questionCount: 5,
    timeLimit: 3600, // 1 hour
    difficulty: 'MIXED',
    enforceSequentialAnswering: false,
    requireAllAnswers: false,
    autoCompleteWhenAllAnswered: true,
    fallbackLimitSeconds: 14400, // 4 hours
  };

  withExamType(examType: ExamType): this {
    this.props.examType = examType;
    return this;
  }

  withCategory(category: Category): this {
    this.props.category = category;
    return this;
  }

  withQuestionCount(count: number): this {
    this.props.questionCount = count;
    return this;
  }

  withTimeLimit(seconds: number): this {
    this.props.timeLimit = seconds;
    return this;
  }

  withDifficulty(difficulty: Difficulty): this {
    this.props.difficulty = difficulty;
    return this;
  }

  withSequentialAnswering(enforce: boolean): this {
    this.props.enforceSequentialAnswering = enforce;
    return this;
  }

  withRequireAllAnswers(require: boolean): this {
    this.props.requireAllAnswers = require;
    return this;
  }

  withAutoComplete(auto: boolean): this {
    this.props.autoCompleteWhenAllAnswered = auto;
    return this;
  }

  build(): QuizConfig {
    const result = QuizConfig.create(this.props as Parameters<typeof QuizConfig.create>[0]);
    if (!result.success) {
      throw new Error(`Failed to create test QuizConfig: ${result.error.message}`);
    }
    return result.data;
  }
}

// Factory function for cleaner syntax
export const aQuizConfig = () => new QuizConfigBuilder();

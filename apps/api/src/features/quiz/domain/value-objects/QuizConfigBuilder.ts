/**
 * Test builder for QuizConfig value object
 * @fileoverview Builder pattern for creating test instances
 */

import { Result } from '@api/shared/result';
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

// Type guard to validate all required properties are set
function isCompleteQuizConfigProps(
  props: QuizConfigBuilderProps
): props is Required<Pick<QuizConfigBuilderProps, 'examType' | 'questionCount'>> &
  QuizConfigBuilderProps {
  return typeof props.examType !== 'undefined' && typeof props.questionCount === 'number';
}

export class QuizConfigBuilder {
  private props: QuizConfigBuilderProps;

  constructor(withDefaults = true) {
    if (withDefaults) {
      this.props = {
        examType: 'CCNA',
        questionCount: 5,
        timeLimit: 3600, // 1 hour
        difficulty: 'MIXED',
        enforceSequentialAnswering: false,
        requireAllAnswers: false,
        autoCompleteWhenAllAnswered: true,
        fallbackLimitSeconds: 14400, // 4 hours
      };
    } else {
      this.props = {};
    }
  }

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

  build(): Result<QuizConfig> {
    // Validate all required properties are set using type guard
    if (!isCompleteQuizConfigProps(this.props)) {
      return Result.fail(
        new Error('Builder is missing required fields (examType and questionCount)')
      );
    }

    // Now props is properly typed and safe to pass to QuizConfig.create
    return QuizConfig.create(this.props);
  }
}

// Factory function for cleaner syntax
export const aQuizConfig = () => new QuizConfigBuilder();

/**
 * Dependency container for quiz feature
 * @fileoverview Centralized service instantiation and dependency injection
 */

import { createDomainLogger } from '@api/infra/logger/PinoLoggerAdapter';
import type { Clock } from '@api/shared/clock';
import { SystemClock } from '@api/shared/clock';
import type { LoggerPort } from '@api/shared/logger/LoggerPort';
import { StubQuestionDetailsService } from '../domain/value-objects/QuestionDetailsService';
import { StubQuestionService as StartQuizQuestionService } from '../start-quiz/QuestionService';
import { StubQuestionService as SubmitAnswerQuestionService } from '../submit-answer/QuestionService';

/**
 * Quiz feature dependencies
 */
interface QuizDependencies {
  /** System clock for timestamps */
  clock: Clock;
  /** Question service for start-quiz operations */
  startQuizQuestionService: StartQuizQuestionService;
  /** Question service for submit-answer operations */
  submitAnswerQuestionService: SubmitAnswerQuestionService;
  /** Question details service for get-results operations */
  questionDetailsService: StubQuestionDetailsService;
  /** Logger factory */
  createLogger: (name: string) => LoggerPort;
}

/**
 * Default production dependencies
 */
const defaultDependencies: QuizDependencies = {
  clock: new SystemClock(),
  startQuizQuestionService: new StartQuizQuestionService(),
  submitAnswerQuestionService: new SubmitAnswerQuestionService(),
  questionDetailsService: new StubQuestionDetailsService(),
  createLogger: createDomainLogger,
};

/**
 * Create a scoped dependency container
 * Useful for isolated testing or specific contexts
 */
function createScopedDependencies(overrides?: Partial<QuizDependencies>): QuizDependencies {
  return {
    ...defaultDependencies,
    ...overrides,
  };
}

/**
 * Dependency provider for route creation
 * Provides a clean interface for accessing dependencies
 */
export class QuizDependencyProvider {
  private dependencies: QuizDependencies;

  constructor(overrides?: Partial<QuizDependencies>) {
    this.dependencies = createScopedDependencies(overrides);
  }

  get clock(): Clock {
    return this.dependencies.clock;
  }

  get startQuizQuestionService(): StartQuizQuestionService {
    return this.dependencies.startQuizQuestionService;
  }

  get submitAnswerQuestionService(): SubmitAnswerQuestionService {
    return this.dependencies.submitAnswerQuestionService;
  }

  get questionDetailsService(): StubQuestionDetailsService {
    return this.dependencies.questionDetailsService;
  }

  createLogger(name: string): LoggerPort {
    return this.dependencies.createLogger(name);
  }

  /**
   * Create a child provider with additional overrides
   */
  createChild(overrides: Partial<QuizDependencies>): QuizDependencyProvider {
    return new QuizDependencyProvider({
      ...this.dependencies,
      ...overrides,
    });
  }
}

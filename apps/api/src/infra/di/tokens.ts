/**
 * Service tokens for dependency injection
 * @fileoverview Defines all service tokens used throughout the application for type-safe DI
 */

import type { IPremiumAccessService } from '@api/features/question/domain';
import type { IQuestionDetailsService } from '@api/features/quiz/domain/value-objects/QuestionDetailsService';
import type { IQuestionService } from '@api/features/quiz/start-quiz/QuestionService';
import type { Clock } from '@api/shared/clock';
import type { IdGenerator } from '@api/shared/id-generator';
import type { IAuthProvider } from '../auth/AuthProvider';
import type { IUnitOfWorkProvider } from '../db/IUnitOfWorkProvider';
import type { DB } from '../db/types';
import type { Logger } from '../logger';
import { createServiceToken } from './DIContainer';

// Database Services
export const DATABASE_CLIENT_TOKEN = createServiceToken<DB>('DATABASE_CLIENT');
export const UNIT_OF_WORK_PROVIDER_TOKEN =
  createServiceToken<IUnitOfWorkProvider>('UNIT_OF_WORK_PROVIDER');

// Authentication Services
export const AUTH_PROVIDER_TOKEN = createServiceToken<IAuthProvider>('AUTH_PROVIDER');

// Premium Access Service
export const PREMIUM_ACCESS_SERVICE_TOKEN =
  createServiceToken<IPremiumAccessService>('PREMIUM_ACCESS_SERVICE');

// Quiz Services
export const QUESTION_SERVICE_TOKEN = createServiceToken<IQuestionService>('QUESTION_SERVICE');
export const QUESTION_DETAILS_SERVICE_TOKEN = createServiceToken<IQuestionDetailsService>(
  'QUESTION_DETAILS_SERVICE'
);

// Infrastructure Services
export const LOGGER_TOKEN = createServiceToken<Logger>('LOGGER');
export const CLOCK_TOKEN = createServiceToken<Clock>('CLOCK');
export const ID_GENERATOR_TOKEN = createServiceToken<IdGenerator>('ID_GENERATOR');

// Feature-specific token groups for better organization
export const DatabaseTokens = {
  CLIENT: DATABASE_CLIENT_TOKEN,
  UNIT_OF_WORK_PROVIDER: UNIT_OF_WORK_PROVIDER_TOKEN,
} as const;

export const AuthTokens = {
  PROVIDER: AUTH_PROVIDER_TOKEN,
} as const;

export const QuizTokens = {
  QUESTION_SERVICE: QUESTION_SERVICE_TOKEN,
  QUESTION_DETAILS_SERVICE: QUESTION_DETAILS_SERVICE_TOKEN,
} as const;

export const InfrastructureTokens = {
  LOGGER: LOGGER_TOKEN,
  CLOCK: CLOCK_TOKEN,
  ID_GENERATOR: ID_GENERATOR_TOKEN,
} as const;

export const PremiumTokens = {
  ACCESS_SERVICE: PREMIUM_ACCESS_SERVICE_TOKEN,
} as const;

// Export all tokens as a single namespace for convenience
export const ServiceTokens = {
  Database: DatabaseTokens,
  Auth: AuthTokens,
  Quiz: QuizTokens,
  Infrastructure: InfrastructureTokens,
  Premium: PremiumTokens,
} as const;

// Type helper to extract service type from token
export type ServiceType<T> = T extends { __brand: infer U } ? U : never;

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
import type { IDatabaseContext } from '../db/IDatabaseContext';
import type { IUnitOfWorkProvider } from '../db/IUnitOfWorkProvider';
import type { DB } from '../db/types';
import type { Logger } from '../logger';
import { createServiceToken } from './DIContainer';

// Database Services
export const DATABASE_CLIENT_TOKEN = createServiceToken<DB>('DATABASE_CLIENT');
export const DATABASE_CONTEXT_TOKEN = createServiceToken<IDatabaseContext>('DATABASE_CONTEXT');
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

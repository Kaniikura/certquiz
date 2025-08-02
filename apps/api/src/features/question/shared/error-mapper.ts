import { createErrorMapper } from '@api/shared/route/route-helpers';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Error mapping type definition
 */
type ErrorMapping = {
  errorName: string;
  status: ContentfulStatusCode;
  code: string;
  message?: string;
};

/**
 * Question domain error mappings
 */
const questionDomainErrorMappings: ErrorMapping[] = [
  // Invalid question data
  {
    errorName: 'InvalidQuestionDataError',
    status: 400,
    code: 'INVALID_QUESTION_DATA',
  },
  // Question access denied
  {
    errorName: 'QuestionAccessDeniedError',
    status: 403,
    code: 'QUESTION_ACCESS_DENIED',
  },
  // Question not found
  {
    errorName: 'QuestionNotFoundError',
    status: 404,
    code: 'QUESTION_NOT_FOUND',
  },
  // Version conflict (optimistic locking)
  {
    errorName: 'QuestionVersionConflictError',
    status: 409,
    code: 'QUESTION_VERSION_CONFLICT',
  },
  // Repository configuration error
  {
    errorName: 'QuestionRepositoryConfigurationError',
    status: 500,
    code: 'REPOSITORY_CONFIG_ERROR',
    message: 'Repository configuration error',
  },
  // Repository errors
  {
    errorName: 'QuestionRepositoryError',
    status: 500,
    code: 'REPOSITORY_ERROR',
    message: 'Database operation failed',
  },
];

/**
 * Question domain error mapper
 * Maps domain errors to HTTP error responses
 */
export const mapQuestionError = createErrorMapper(questionDomainErrorMappings);

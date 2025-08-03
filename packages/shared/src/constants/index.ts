// Quiz configuration
export const QUIZ_SIZES = [1, 3, 5, 10] as const;
export type QuizSize = (typeof QUIZ_SIZES)[number];

// Configuration
export const CONFIG = Object.freeze({
  MAX_OPTIONS: 6,
  MIN_OPTIONS: 2,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  TOKEN_EXPIRY: '24h',
  REFRESH_TOKEN_EXPIRY: '7d',
  MIN_PASSWORD_LENGTH: 8,
  MAX_QUESTION_LENGTH: 1000,
  MAX_OPTION_LENGTH: 500,
  MAX_EXPLANATION_LENGTH: 2000,
  MAX_REPORT_DESCRIPTION_LENGTH: 500,
});

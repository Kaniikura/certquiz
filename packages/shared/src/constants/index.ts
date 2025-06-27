// Quiz configuration
export const QUIZ_SIZES = [1, 3, 5, 10] as const;
export type QuizSize = (typeof QUIZ_SIZES)[number];

export const EXAM_TYPES = ['CCNP', 'CCIE'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const USER_ROLES = ['guest', 'user', 'premium', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const QUESTION_TYPES = ['single', 'multiple'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_STATUS = ['active', 'pending', 'archived'] as const;
export type QuestionStatus = (typeof QUESTION_STATUS)[number];

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

// API endpoints
export const API_ENDPOINTS = Object.freeze({
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },
  QUESTIONS: {
    LIST: '/questions',
    DETAIL: '/questions/:id',
    CREATE: '/questions',
    UPDATE: '/questions/:id',
    DELETE: '/questions/:id',
  },
  QUIZ: {
    START: '/quiz/start',
    ANSWER: '/quiz/:sessionId/answer',
    CURRENT: '/quiz/:sessionId/current',
    RESULTS: '/quiz/:sessionId/results',
  },
  PROGRESS: {
    GET: '/progress',
    UPDATE: '/progress',
  },
  BADGES: {
    LIST: '/badges',
    USER: '/badges/user',
  },
  REPORTS: {
    CREATE: '/reports',
    LIST: '/reports',
    USER: '/reports/mine',
    ADMIN: '/admin/reports',
    REVIEW: '/admin/reports/:id/review',
  },
  ADMIN: {
    STATS: '/admin/stats',
    USERS: '/admin/users',
    QUESTIONS: '/admin/questions',
  },
  WEBHOOKS: {
    BMAC: '/webhooks/bmac',
  },
});

// Error codes
export const ERROR_CODES = Object.freeze({
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Permission errors
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PRIVILEGES: 'INSUFFICIENT_PRIVILEGES',

  // Rate limiting
  RATE_LIMIT: 'RATE_LIMIT',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
});

// Badge requirement types
export const BADGE_REQUIREMENT_TYPES = Object.freeze({
  QUESTIONS_SOLVED: 'questions_solved',
  ACCURACY: 'accuracy',
  STREAK: 'streak',
  CATEGORY_MASTERY: 'category_mastery',
});

// Report types
export const REPORT_TYPES = Object.freeze({
  ERROR: 'error',
  UNCLEAR: 'unclear',
  OUTDATED: 'outdated',
});

// Categories
export const QUESTION_CATEGORIES = Object.freeze({
  CCNP: ['OSPF', 'EIGRP', 'BGP', 'MPLS', 'QoS', 'Security', 'IPv6', 'Multicast', 'VPN', 'SD-WAN'],
  CCIE: [
    'Network Infrastructure',
    'Software Defined Infrastructure',
    'Transport Technologies',
    'Infrastructure Security',
    'Infrastructure Services',
    'Infrastructure Automation',
  ],
});

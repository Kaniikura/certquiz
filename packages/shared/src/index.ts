// This package provides shared utilities and constants for CertQuiz
// Import directly from submodules instead of using barrel exports:
// - Constants: import { CONFIG, EXAM_TYPES } from '@certquiz/shared/constants'
// - Utils: import { Result, calculateAccuracy } from '@certquiz/shared/utils'
//
// For backward compatibility, common types are still available from main export:

export type { ExamType, QuestionStatus, QuestionType, QuizSize, UserRole } from './constants';
export type { Result } from './utils';

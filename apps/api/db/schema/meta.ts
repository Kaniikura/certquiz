// meta.ts – Test expectations for database schema validation
// These arrays are maintained manually but provide clear expectations
// for integration tests. Update these when schema changes.

// 1. Expected Tables ---------------------------------------------------------------
// Derived from current schema - update when adding/removing tables
export const EXPECTED_TABLES = [
  'badges',
  'bookmarks',
  'categories',
  'exams',
  'problem_reports',
  'question_categories',
  'question_exams',
  'question_history',
  'question_options',
  'questions',
  'quiz_sessions',
  'session_questions',
  'session_selected_options',
  'subscriptions',
  'user_badges',
  'user_progress',
  'users',
  'webhook_events',
].sort();

// 2. Expected Enums ---------------------------------------------------------------
// Derived from current schema - update when adding/removing enums
export const EXPECTED_ENUMS = [
  'question_status',
  'question_type',
  'report_status',
  'report_type',
  'subscription_plan',
  'subscription_status',
  'user_role',
].sort();

// 3. Expected minimum counts for validation -------------------------------
// These are derived from current schema knowledge and can be updated
// as the schema evolves

export const EXPECTED_TABLE_COUNT = 18; // Current number of tables
export const EXPECTED_ENUM_COUNT = 7; // Current number of enums

// These will be used instead of magic numbers like "> 25" or "> 10"
export const MIN_EXPECTED_INDEXES = 25; // Minimum expected indexes
export const MIN_EXPECTED_FOREIGN_KEYS = 10; // Minimum expected foreign keys

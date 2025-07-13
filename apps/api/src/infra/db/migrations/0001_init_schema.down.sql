-- Drop tables in reverse dependency order to handle foreign key constraints
DROP TABLE IF EXISTS "bookmarks";
DROP TABLE IF EXISTS "question_version";
DROP TABLE IF EXISTS "question";
DROP TABLE IF EXISTS "quiz_session_event";
DROP TABLE IF EXISTS "quiz_session_snapshot";
DROP TABLE IF EXISTS "user_progress";
DROP TABLE IF EXISTS "subscriptions";
DROP TABLE IF EXISTS "webhook_event";
DROP TABLE IF EXISTS "auth_user";

-- Drop ENUMs
DROP TYPE IF EXISTS "public"."webhook_status";
DROP TYPE IF EXISTS "public"."user_role";
DROP TYPE IF EXISTS "public"."subscription_status";
DROP TYPE IF EXISTS "public"."subscription_plan";
DROP TYPE IF EXISTS "public"."quiz_state";
DROP TYPE IF EXISTS "public"."question_type";
DROP TYPE IF EXISTS "public"."question_status";
DROP TYPE IF EXISTS "public"."exam_type";
DROP TYPE IF EXISTS "public"."difficulty";
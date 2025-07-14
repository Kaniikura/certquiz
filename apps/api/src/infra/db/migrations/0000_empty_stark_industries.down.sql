-- Down migration for 0000_empty_stark_industries
-- This reverses all changes made in the up migration

-- Drop all indexes first (to avoid dependency issues)
DROP INDEX IF EXISTS "ix_webhook_retry";
DROP INDEX IF EXISTS "ix_webhook_type";
DROP INDEX IF EXISTS "ix_webhook_status_scheduled";
DROP INDEX IF EXISTS "ix_progress_category_stats_gin";
DROP INDEX IF EXISTS "ix_progress_user_stats";
DROP INDEX IF EXISTS "ix_progress_last_study";
DROP INDEX IF EXISTS "ix_progress_experience_desc";
DROP INDEX IF EXISTS "unq_bmac_email";
DROP INDEX IF EXISTS "ix_subscriptions_status";
DROP INDEX IF EXISTS "ix_subscriptions_bmac_email";
DROP INDEX IF EXISTS "ix_snapshot_active_expiry";
DROP INDEX IF EXISTS "ix_snapshot_expired_cleanup";
DROP INDEX IF EXISTS "ix_snapshot_state_started";
DROP INDEX IF EXISTS "ix_snapshot_owner_started";
DROP INDEX IF EXISTS "ix_snapshot_owner_state";
DROP INDEX IF EXISTS "ix_snapshot_active_user";
DROP INDEX IF EXISTS "ix_quiz_event_payload";
DROP INDEX IF EXISTS "ix_quiz_event_type";
DROP INDEX IF EXISTS "ix_quiz_event_occurred";
DROP INDEX IF EXISTS "ix_quiz_event_session_version";
DROP INDEX IF EXISTS "pk_quiz_session_event";
DROP INDEX IF EXISTS "ix_question_type_difficulty";
DROP INDEX IF EXISTS "ix_question_options_gin";
DROP INDEX IF EXISTS "ix_question_categories";
DROP INDEX IF EXISTS "ix_question_exam_types";
DROP INDEX IF EXISTS "ix_question_tags";
DROP INDEX IF EXISTS "ix_question_text_search";
DROP INDEX IF EXISTS "ix_question_version_current";
DROP INDEX IF EXISTS "pk_question_version";
DROP INDEX IF EXISTS "ix_question_premium";
DROP INDEX IF EXISTS "ix_question_created_by";
DROP INDEX IF EXISTS "ix_question_status_active";
DROP INDEX IF EXISTS "ix_bookmarks_user";
DROP INDEX IF EXISTS "pk_bookmarks";
DROP INDEX IF EXISTS "ix_user_role_active";
DROP INDEX IF EXISTS "ix_user_identity_provider";
DROP INDEX IF EXISTS "ix_user_email";

-- Drop all tables (CASCADE will handle foreign key dependencies)
DROP TABLE IF EXISTS "webhook_event" CASCADE;
DROP TABLE IF EXISTS "user_progress" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "quiz_session_snapshot" CASCADE;
DROP TABLE IF EXISTS "quiz_session_event" CASCADE;
DROP TABLE IF EXISTS "question_version" CASCADE;
DROP TABLE IF EXISTS "question" CASCADE;
DROP TABLE IF EXISTS "bookmarks" CASCADE;
DROP TABLE IF EXISTS "test_migration" CASCADE;
DROP TABLE IF EXISTS "test_users" CASCADE;
DROP TABLE IF EXISTS "drizzle_migrations" CASCADE;
DROP TABLE IF EXISTS "auth_user" CASCADE;

-- Drop all custom types/enums
DROP TYPE IF EXISTS "webhook_status";
DROP TYPE IF EXISTS "user_role";
DROP TYPE IF EXISTS "subscription_status";
DROP TYPE IF EXISTS "subscription_plan";
DROP TYPE IF EXISTS "quiz_state";
DROP TYPE IF EXISTS "question_type";
DROP TYPE IF EXISTS "question_status";
DROP TYPE IF EXISTS "exam_type";
DROP TYPE IF EXISTS "difficulty";
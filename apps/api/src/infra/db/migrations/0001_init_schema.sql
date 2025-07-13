CREATE TYPE "public"."difficulty" AS ENUM('Beginner', 'Intermediate', 'Advanced', 'Expert', 'Mixed');--> statement-breakpoint
CREATE TYPE "public"."exam_type" AS ENUM('CCNA', 'CCNP_ENCOR', 'CCNP_ENARSI', 'SECURITY_PLUS');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('single', 'multiple');--> statement-breakpoint
CREATE TYPE "public"."quiz_state" AS ENUM('IN_PROGRESS', 'COMPLETED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('guest', 'user', 'premium', 'admin');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "auth_user" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"keycloak_id" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email"),
	CONSTRAINT "auth_user_username_unique" UNIQUE("username"),
	CONSTRAINT "auth_user_keycloak_id_unique" UNIQUE("keycloak_id")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question" (
	"question_id" uuid PRIMARY KEY NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_by_id" uuid NOT NULL,
	"is_user_generated" boolean DEFAULT false NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"status" "question_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_version" (
	"question_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"question_text" text NOT NULL,
	"question_type" "question_type" NOT NULL,
	"explanation" text NOT NULL,
	"detailed_explanation" text,
	"images" text[] DEFAULT '{}',
	"tags" text[] DEFAULT '{}' NOT NULL,
	"options" jsonb NOT NULL,
	"exam_types" text[] DEFAULT '{}' NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"difficulty" "difficulty" DEFAULT 'Mixed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_options_min_count" CHECK (jsonb_array_length(options) >= 2),
	CONSTRAINT "ck_has_correct_answer" CHECK (options::text LIKE '%"isCorrect":true%')
);
--> statement-breakpoint
CREATE TABLE "quiz_session_event" (
	"session_id" uuid NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_sequence" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ck_event_sequence_positive" CHECK (event_sequence > 0),
	CONSTRAINT "ck_version_positive" CHECK (version > 0)
);
--> statement-breakpoint
CREATE TABLE "quiz_session_snapshot" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"state" "quiz_state" NOT NULL,
	"question_count" integer NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"version" bigint NOT NULL,
	"config" jsonb NOT NULL,
	"question_order" uuid[] NOT NULL,
	"answers" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_session_state_consistency" CHECK (
      CASE 
        WHEN state = 'IN_PROGRESS' THEN expires_at IS NOT NULL
        WHEN state = 'COMPLETED' THEN completed_at IS NOT NULL
        WHEN state = 'EXPIRED' THEN completed_at IS NOT NULL
        ELSE true
      END
    ),
	CONSTRAINT "ck_question_index_bounds" CHECK (current_question_index >= 0 AND current_question_index < question_count)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"buy_me_a_coffee_email" text,
	"start_date" timestamp with time zone DEFAULT now() NOT NULL,
	"end_date" timestamp with time zone,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"accuracy" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"study_time_minutes" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"last_study_date" timestamp with time zone,
	"category_stats" jsonb DEFAULT '{"version":1}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_progress_accuracy_range" CHECK (accuracy >= 0 AND accuracy <= 100),
	CONSTRAINT "ck_progress_non_negative_values" CHECK (
      level >= 1 AND 
      experience >= 0 AND 
      total_questions >= 0 AND 
      correct_answers >= 0 AND
      study_time_minutes >= 0 AND 
      current_streak >= 0
    ),
	CONSTRAINT "ck_correct_answers_not_exceed_total" CHECK (correct_answers <= total_questions)
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "webhook_status" DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_auth_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_question_id_question_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_created_by_id_auth_user_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."auth_user"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_version" ADD CONSTRAINT "question_version_question_id_question_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("question_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_session_snapshot" ADD CONSTRAINT "quiz_session_snapshot_owner_id_auth_user_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."auth_user"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_auth_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_auth_user_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_user_email" ON "auth_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ix_user_keycloak" ON "auth_user" USING btree ("keycloak_id");--> statement-breakpoint
CREATE INDEX "ix_user_role_active" ON "auth_user" USING btree ("role","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "pk_bookmarks" ON "bookmarks" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "ix_bookmarks_user" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_question_status_active" ON "question" USING btree ("status","updated_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "ix_question_created_by" ON "question" USING btree ("created_by_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_question_premium" ON "question" USING btree ("is_premium","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pk_question_version" ON "question_version" USING btree ("question_id","version");--> statement-breakpoint
CREATE INDEX "ix_question_version_current" ON "question_version" USING btree ("question_id","version");--> statement-breakpoint
CREATE INDEX "ix_question_text_search" ON "question_version" USING btree (to_tsvector('english', "question_text"));--> statement-breakpoint
CREATE INDEX "ix_question_tags" ON "question_version" USING btree ("tags");--> statement-breakpoint
CREATE INDEX "ix_question_exam_types" ON "question_version" USING btree ("exam_types");--> statement-breakpoint
CREATE INDEX "ix_question_categories" ON "question_version" USING btree ("categories");--> statement-breakpoint
CREATE INDEX "ix_question_options_gin" ON "question_version" USING gin ("options");--> statement-breakpoint
CREATE INDEX "ix_question_type_difficulty" ON "question_version" USING btree ("question_type","difficulty");--> statement-breakpoint
CREATE UNIQUE INDEX "pk_quiz_session_event" ON "quiz_session_event" USING btree ("session_id","version","event_sequence");--> statement-breakpoint
CREATE INDEX "ix_quiz_event_session_version" ON "quiz_session_event" USING btree ("session_id","version");--> statement-breakpoint
CREATE INDEX "ix_quiz_event_occurred" ON "quiz_session_event" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "ix_quiz_event_type" ON "quiz_session_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "ix_quiz_event_payload" ON "quiz_session_event" USING btree ("event_type", "payload");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_snapshot_active_user" ON "quiz_session_snapshot" USING btree ("owner_id") WHERE state = 'IN_PROGRESS';--> statement-breakpoint
CREATE INDEX "ix_snapshot_owner_state" ON "quiz_session_snapshot" USING btree ("owner_id","state");--> statement-breakpoint
CREATE INDEX "ix_snapshot_owner_started" ON "quiz_session_snapshot" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "ix_snapshot_state_started" ON "quiz_session_snapshot" USING btree ("state","started_at");--> statement-breakpoint
CREATE INDEX "ix_snapshot_expired_cleanup" ON "quiz_session_snapshot" USING btree ("completed_at") WHERE state IN ('COMPLETED', 'EXPIRED');--> statement-breakpoint
CREATE INDEX "ix_snapshot_active_expiry" ON "quiz_session_snapshot" USING btree ("expires_at") WHERE state = 'IN_PROGRESS';--> statement-breakpoint
CREATE INDEX "ix_subscriptions_bmac_email" ON "subscriptions" USING btree ("buy_me_a_coffee_email");--> statement-breakpoint
CREATE INDEX "ix_subscriptions_status" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_bmac_email" ON "subscriptions" USING btree ("buy_me_a_coffee_email");--> statement-breakpoint
CREATE INDEX "ix_progress_experience_desc" ON "user_progress" USING btree ("experience" DESC);--> statement-breakpoint
CREATE INDEX "ix_progress_last_study" ON "user_progress" USING btree ("last_study_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ix_progress_user_stats" ON "user_progress" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "ix_progress_category_stats_gin" ON "user_progress" USING gin ("category_stats");--> statement-breakpoint
CREATE INDEX "ix_webhook_status_scheduled" ON "webhook_event" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "ix_webhook_type" ON "webhook_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "ix_webhook_retry" ON "webhook_event" USING btree ("retry_count") WHERE status = 'failed';
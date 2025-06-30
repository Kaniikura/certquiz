ALTER TABLE "problem_reports" DROP CONSTRAINT "problem_reports_question_id_questions_id_fk";

ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_users_id_fk";

ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "extraction_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"model_run_id" uuid NOT NULL,
	"candidate_index" integer NOT NULL,
	"source_id" uuid NOT NULL,
	"source_hash" text NOT NULL,
	"claim" jsonb NOT NULL,
	"decision_scope_id" uuid,
	"state" text NOT NULL,
	"reviewer" text NOT NULL,
	"rationale" text NOT NULL,
	"supersedes" uuid,
	"versions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extraction_reviews_supersedes_unique" UNIQUE("supersedes"),
	CONSTRAINT "review_state" CHECK ("extraction_reviews"."state" in ('pending_review','accepted','rejected')),
	CONSTRAINT "review_candidate_index" CHECK ("extraction_reviews"."candidate_index" >= 0)
);
--> statement-breakpoint
ALTER TABLE "extraction_reviews" ADD CONSTRAINT "extraction_reviews_model_run_id_model_runs_id_fk" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_reviews" ADD CONSTRAINT "extraction_reviews_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_reviews" ADD CONSTRAINT "extraction_reviews_dataset_id_source_id_source_records_dataset_id_id_fk" FOREIGN KEY ("dataset_id","source_id") REFERENCES "public"."source_records"("dataset_id","id") ON DELETE no action ON UPDATE no action;
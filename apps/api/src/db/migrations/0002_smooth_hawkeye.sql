CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'decision' NOT NULL,
	"account_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"deal_id" uuid,
	"requester_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"value" text NOT NULL,
	"rationale" text NOT NULL,
	"feature_external_id" text,
	"commitment_status" text,
	"source_id" uuid NOT NULL,
	CONSTRAINT "decisions_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "decisions_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "decision_kind" CHECK ("decisions"."entity_kind" = 'decision')
);
--> statement-breakpoint
CREATE TABLE "account_diagnoses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"signal_id" uuid,
	"deal_id" uuid,
	"scope_key" text NOT NULL,
	"diagnosis" jsonb NOT NULL,
	CONSTRAINT "account_diagnoses_dataset_id_scope_key_unique" UNIQUE("dataset_id","scope_key")
);
--> statement-breakpoint
ALTER TABLE "findings" ALTER COLUMN "signal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendations" ALTER COLUMN "signal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_dataset_id_deal_id_deals_dataset_id_id_fk" FOREIGN KEY ("dataset_id","deal_id") REFERENCES "public"."deals"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_dataset_id_requester_id_employees_dataset_id_id_fk" FOREIGN KEY ("dataset_id","requester_id") REFERENCES "public"."employees"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_dataset_id_approver_id_employees_dataset_id_id_fk" FOREIGN KEY ("dataset_id","approver_id") REFERENCES "public"."employees"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_dataset_id_source_id_source_records_dataset_id_id_fk" FOREIGN KEY ("dataset_id","source_id") REFERENCES "public"."source_records"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_diagnoses" ADD CONSTRAINT "account_diagnoses_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_diagnoses" ADD CONSTRAINT "account_diagnoses_dataset_id_signal_id_expansion_signals_dataset_id_id_fk" FOREIGN KEY ("dataset_id","signal_id") REFERENCES "public"."expansion_signals"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_diagnoses" ADD CONSTRAINT "account_diagnoses_dataset_id_deal_id_deals_dataset_id_id_fk" FOREIGN KEY ("dataset_id","deal_id") REFERENCES "public"."deals"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_diagnoses" ADD CONSTRAINT "account_diagnoses_dataset_id_run_id_analysis_runs_dataset_id_id_fk" FOREIGN KEY ("dataset_id","run_id") REFERENCES "public"."analysis_runs"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendation_scope" CHECK ("recommendations"."signal_id" is not null or "recommendations"."account_id" is not null);
CREATE TABLE "model_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"cache_key" text NOT NULL,
	"input_hash" text NOT NULL,
	"operation" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"schema_version" text NOT NULL,
	"parameters_version" text NOT NULL,
	"status" text NOT NULL,
	"output" jsonb,
	"latency_ms" integer NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(20, 10),
	"cost_basis" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_run_status" CHECK ("model_runs"."status" in ('succeeded','unavailable','invalid','timeout','provider_error','budget_exceeded')),
	CONSTRAINT "model_run_usage" CHECK ("model_runs"."latency_ms" >= 0 and ("model_runs"."input_tokens" is null or "model_runs"."input_tokens" >= 0) and ("model_runs"."output_tokens" is null or "model_runs"."output_tokens" >= 0) and ("model_runs"."cost_usd" is null or "model_runs"."cost_usd" >= 0))
);
--> statement-breakpoint
ALTER TABLE "model_runs" ADD CONSTRAINT "model_runs_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_cache_idx" ON "model_runs" USING btree ("dataset_id","account_id","cache_key","status");
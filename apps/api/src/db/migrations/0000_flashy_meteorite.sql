CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'account' NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"champion_external_id" text,
	"package" text,
	"outlet_count" integer,
	CONSTRAINT "accounts_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "accounts_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "account_kind" CHECK ("accounts"."entity_kind" = 'account'),
	CONSTRAINT "account_type" CHECK ("accounts"."type" in ('customer','prospect'))
);
--> statement-breakpoint
CREATE TABLE "analysis_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"as_of" date NOT NULL,
	"rule_version" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_runs_dataset_id_id_unique" UNIQUE("dataset_id","id")
);
--> statement-breakpoint
CREATE TABLE "assertion_evidence" (
	"dataset_id" uuid NOT NULL,
	"assertion_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"field" text NOT NULL,
	"passage" text NOT NULL,
	"relation" text NOT NULL,
	CONSTRAINT "assertion_evidence_assertion_id_source_id_field_unique" UNIQUE("assertion_id","source_id","field")
);
--> statement-breakpoint
CREATE TABLE "assertions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"predicate" text NOT NULL,
	"object_id" uuid,
	"literal" jsonb,
	"account_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"speaker_id" uuid,
	"attribution" text NOT NULL,
	"method" text NOT NULL,
	"verification" text NOT NULL,
	"run_id" uuid NOT NULL,
	CONSTRAINT "assertions_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "assertion_one_target" CHECK (("assertions"."object_id" is null) <> ("assertions"."literal" is null))
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'contact' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"account_id" uuid NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "contacts_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "contacts_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "contact_kind" CHECK ("contacts"."entity_kind" = 'contact')
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'contract' NOT NULL,
	"account_id" uuid NOT NULL,
	"package" text NOT NULL,
	"outlets" integer NOT NULL,
	"outlet_limit" integer,
	"unlimited" boolean NOT NULL,
	"start_date" date NOT NULL,
	"renewal_date" date NOT NULL,
	"monthly_rate" numeric(20, 2) NOT NULL,
	"discount_percent" numeric(5, 2) NOT NULL,
	"annual_value" numeric(20, 2) NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"decision_external_id" text,
	CONSTRAINT "contracts_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "contracts_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "contract_kind" CHECK ("contracts"."entity_kind" = 'contract'),
	CONSTRAINT "contract_numbers" CHECK ("contracts"."outlets" >= 0 and "contracts"."monthly_rate" >= 0 and "contracts"."discount_percent" between 0 and 100),
	CONSTRAINT "contract_limit" CHECK (("contracts"."unlimited" and "contracts"."outlet_limit" is null) or (not "contracts"."unlimited" and "contracts"."outlet_limit" >= 0))
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"manifest_hash" text NOT NULL,
	"mapping_version" text NOT NULL,
	"as_of" date NOT NULL,
	"status" text NOT NULL,
	"coverage" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "datasets_manifest_hash_unique" UNIQUE("manifest_hash"),
	CONSTRAINT "dataset_status" CHECK ("datasets"."status" in ('staging','incomplete','ready'))
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'deal' NOT NULL,
	"account_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" text NOT NULL,
	"stage" text NOT NULL,
	"stage_since" date NOT NULL,
	"created_date" date NOT NULL,
	"outlets" integer,
	"annual_value" numeric(20, 2),
	"status" text NOT NULL,
	CONSTRAINT "deals_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "deals_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "deal_kind" CHECK ("deals"."entity_kind" = 'deal')
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'employee' NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"email" text NOT NULL,
	CONSTRAINT "employees_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "employees_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "employee_kind" CHECK ("employees"."entity_kind" = 'employee')
);
--> statement-breakpoint
CREATE TABLE "contact_employments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'employment' NOT NULL,
	"contact_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid,
	"role" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	CONSTRAINT "contact_employments_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "contact_employments_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "employment_kind" CHECK ("contact_employments"."entity_kind" = 'employment'),
	CONSTRAINT "employment_interval" CHECK ("contact_employments"."end_date" is null or "contact_employments"."end_date" >= "contact_employments"."start_date")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"external_id" text NOT NULL,
	CONSTRAINT "entities_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "entities_dataset_id_id_kind_unique" UNIQUE("dataset_id","id","kind"),
	CONSTRAINT "entities_dataset_id_kind_external_id_unique" UNIQUE("dataset_id","kind","external_id")
);
--> statement-breakpoint
CREATE TABLE "entity_sources" (
	"dataset_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "entity_sources_entity_id_source_id_unique" UNIQUE("entity_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "finding_evidence" (
	"dataset_id" uuid NOT NULL,
	"finding_id" uuid NOT NULL,
	"source_id" uuid,
	"check_result" jsonb,
	CONSTRAINT "finding_evidence_target" CHECK ("finding_evidence"."source_id" is not null or "finding_evidence"."check_result" is not null)
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"commercial_context" text NOT NULL,
	"type" text NOT NULL,
	"details" jsonb NOT NULL,
	CONSTRAINT "findings_dataset_id_id_unique" UNIQUE("dataset_id","id")
);
--> statement-breakpoint
CREATE TABLE "ingestion_errors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"file_id" uuid,
	"locator" integer,
	"code" text NOT NULL,
	"field" text,
	"disposition" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'interaction' NOT NULL,
	"account_id" uuid,
	"event_date" date NOT NULL,
	"type" text NOT NULL,
	"sender" text NOT NULL,
	"recipients" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"parent_id" uuid,
	CONSTRAINT "interactions_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "interactions_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "interaction_kind" CHECK ("interactions"."entity_kind" = 'interaction')
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'organization' NOT NULL,
	"name" text NOT NULL,
	"account_id" uuid,
	CONSTRAINT "organizations_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "organizations_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "organization_kind" CHECK ("organizations"."entity_kind" = 'organization')
);
--> statement-breakpoint
CREATE TABLE "interaction_participants" (
	"dataset_id" uuid NOT NULL,
	"interaction_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "interaction_participants_interaction_id_person_id_role_unique" UNIQUE("interaction_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"contact_id" uuid,
	"route" text NOT NULL,
	"review_status" text DEFAULT 'proposed' NOT NULL,
	"card" jsonb NOT NULL,
	CONSTRAINT "recommendations_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "recommendations_run_id_signal_id_unique" UNIQUE("run_id","signal_id")
);
--> statement-breakpoint
CREATE TABLE "signal_deal_matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"signal_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expansion_signals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"entity_kind" text DEFAULT 'signal' NOT NULL,
	"account_id" uuid NOT NULL,
	"request_date" date NOT NULL,
	"quantity" integer,
	"location" text,
	"target_period" text,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"dedup_key" text NOT NULL,
	"run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "expansion_signals_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "expansion_signals_dataset_id_external_id_unique" UNIQUE("dataset_id","external_id"),
	CONSTRAINT "expansion_signals_dataset_id_dedup_key_unique" UNIQUE("dataset_id","dedup_key"),
	CONSTRAINT "signal_kind" CHECK ("expansion_signals"."entity_kind" = 'signal')
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"sha256" text NOT NULL,
	"relative_path" text NOT NULL,
	"record_count" integer NOT NULL,
	CONSTRAINT "source_files_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "source_files_dataset_id_filename_unique" UNIQUE("dataset_id","filename")
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"locator" integer NOT NULL,
	"external_id" text,
	"account_external_id" text,
	"payload" jsonb NOT NULL,
	"raw_text" text NOT NULL,
	"content_hash" text NOT NULL,
	"search_text" text NOT NULL,
	CONSTRAINT "source_records_dataset_id_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "source_records_file_id_locator_unique" UNIQUE("file_id","locator")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_dataset_id_owner_id_employees_dataset_id_id_fk" FOREIGN KEY ("dataset_id","owner_id") REFERENCES "public"."employees"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_evidence" ADD CONSTRAINT "assertion_evidence_dataset_id_assertion_id_assertions_dataset_id_id_fk" FOREIGN KEY ("dataset_id","assertion_id") REFERENCES "public"."assertions"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_evidence" ADD CONSTRAINT "assertion_evidence_dataset_id_source_id_source_records_dataset_id_id_fk" FOREIGN KEY ("dataset_id","source_id") REFERENCES "public"."source_records"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_dataset_id_subject_id_entities_dataset_id_id_fk" FOREIGN KEY ("dataset_id","subject_id") REFERENCES "public"."entities"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_dataset_id_object_id_entities_dataset_id_id_fk" FOREIGN KEY ("dataset_id","object_id") REFERENCES "public"."entities"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_dataset_id_speaker_id_entities_dataset_id_id_fk" FOREIGN KEY ("dataset_id","speaker_id") REFERENCES "public"."entities"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_dataset_id_run_id_analysis_runs_dataset_id_id_fk" FOREIGN KEY ("dataset_id","run_id") REFERENCES "public"."analysis_runs"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_dataset_id_owner_id_employees_dataset_id_id_fk" FOREIGN KEY ("dataset_id","owner_id") REFERENCES "public"."employees"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_employments" ADD CONSTRAINT "contact_employments_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_employments" ADD CONSTRAINT "contact_employments_dataset_id_contact_id_contacts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","contact_id") REFERENCES "public"."contacts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_employments" ADD CONSTRAINT "contact_employments_dataset_id_organization_id_organizations_dataset_id_id_fk" FOREIGN KEY ("dataset_id","organization_id") REFERENCES "public"."organizations"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_employments" ADD CONSTRAINT "contact_employments_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_sources" ADD CONSTRAINT "entity_sources_dataset_id_entity_id_entities_dataset_id_id_fk" FOREIGN KEY ("dataset_id","entity_id") REFERENCES "public"."entities"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_sources" ADD CONSTRAINT "entity_sources_dataset_id_source_id_source_records_dataset_id_id_fk" FOREIGN KEY ("dataset_id","source_id") REFERENCES "public"."source_records"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_dataset_id_finding_id_findings_dataset_id_id_fk" FOREIGN KEY ("dataset_id","finding_id") REFERENCES "public"."findings"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_dataset_id_source_id_source_records_dataset_id_id_fk" FOREIGN KEY ("dataset_id","source_id") REFERENCES "public"."source_records"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_dataset_id_signal_id_expansion_signals_dataset_id_id_fk" FOREIGN KEY ("dataset_id","signal_id") REFERENCES "public"."expansion_signals"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_dataset_id_run_id_analysis_runs_dataset_id_id_fk" FOREIGN KEY ("dataset_id","run_id") REFERENCES "public"."analysis_runs"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "ingestion_errors_dataset_id_file_id_source_files_dataset_id_id_fk" FOREIGN KEY ("dataset_id","file_id") REFERENCES "public"."source_files"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_dataset_id_parent_id_interactions_dataset_id_id_fk" FOREIGN KEY ("dataset_id","parent_id") REFERENCES "public"."interactions"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_participants" ADD CONSTRAINT "interaction_participants_dataset_id_interaction_id_interactions_dataset_id_id_fk" FOREIGN KEY ("dataset_id","interaction_id") REFERENCES "public"."interactions"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_participants" ADD CONSTRAINT "interaction_participants_dataset_id_person_id_entities_dataset_id_id_fk" FOREIGN KEY ("dataset_id","person_id") REFERENCES "public"."entities"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_dataset_id_signal_id_expansion_signals_dataset_id_id_fk" FOREIGN KEY ("dataset_id","signal_id") REFERENCES "public"."expansion_signals"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_dataset_id_owner_id_employees_dataset_id_id_fk" FOREIGN KEY ("dataset_id","owner_id") REFERENCES "public"."employees"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_dataset_id_contact_id_contacts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","contact_id") REFERENCES "public"."contacts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_dataset_id_run_id_analysis_runs_dataset_id_id_fk" FOREIGN KEY ("dataset_id","run_id") REFERENCES "public"."analysis_runs"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_deal_matches" ADD CONSTRAINT "signal_deal_matches_dataset_id_signal_id_expansion_signals_dataset_id_id_fk" FOREIGN KEY ("dataset_id","signal_id") REFERENCES "public"."expansion_signals"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_deal_matches" ADD CONSTRAINT "signal_deal_matches_dataset_id_deal_id_deals_dataset_id_id_fk" FOREIGN KEY ("dataset_id","deal_id") REFERENCES "public"."deals"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_deal_matches" ADD CONSTRAINT "signal_deal_matches_dataset_id_run_id_analysis_runs_dataset_id_id_fk" FOREIGN KEY ("dataset_id","run_id") REFERENCES "public"."analysis_runs"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_signals" ADD CONSTRAINT "expansion_signals_dataset_id_id_entity_kind_entities_dataset_id_id_kind_fk" FOREIGN KEY ("dataset_id","id","entity_kind") REFERENCES "public"."entities"("dataset_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_signals" ADD CONSTRAINT "expansion_signals_dataset_id_account_id_accounts_dataset_id_id_fk" FOREIGN KEY ("dataset_id","account_id") REFERENCES "public"."accounts"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_signals" ADD CONSTRAINT "expansion_signals_dataset_id_run_id_analysis_runs_dataset_id_id_fk" FOREIGN KEY ("dataset_id","run_id") REFERENCES "public"."analysis_runs"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expansion_signals" ADD CONSTRAINT "expansion_signals_dataset_id_source_id_source_records_dataset_id_id_fk" FOREIGN KEY ("dataset_id","source_id") REFERENCES "public"."source_records"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_dataset_id_file_id_source_files_dataset_id_id_fk" FOREIGN KEY ("dataset_id","file_id") REFERENCES "public"."source_files"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assertion_traversal_idx" ON "assertions" USING btree ("dataset_id","subject_id","predicate");--> statement-breakpoint
CREATE INDEX "deal_account_idx" ON "deals" USING btree ("dataset_id","account_id");--> statement-breakpoint
CREATE INDEX "interaction_account_date_idx" ON "interactions" USING btree ("dataset_id","account_id","event_date");--> statement-breakpoint
CREATE INDEX "source_account_idx" ON "source_records" USING btree ("dataset_id","account_external_id");
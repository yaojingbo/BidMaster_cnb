CREATE TABLE "ai_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"api_key_ref" varchar(200),
	"api_endpoint" varchar(500),
	"is_active" boolean DEFAULT false NOT NULL,
	"is_tested" boolean DEFAULT false NOT NULL,
	"last_tested_at" timestamp,
	"last_test_result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"model" varchar(100),
	"provider" varchar(50),
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"details" jsonb,
	"ip_address" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"source" varchar(20) DEFAULT 'web' NOT NULL,
	"ip_address" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"confidence" integer,
	"position" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statistics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"description" varchar(500),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_configurations_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tender_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"original_name" varchar(500),
	"size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"category" varchar(50) DEFAULT 'tender' NOT NULL,
	"status" varchar(20) DEFAULT 'uploading' NOT NULL,
	"encrypted_path" text NOT NULL,
	"encryption_key_id" varchar(100),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_document_id_tender_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."tender_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_document_id_tender_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."tender_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_elements" ADD CONSTRAINT "extracted_elements_analysis_id_analysis_results_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analysis_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statistics" ADD CONSTRAINT "statistics_analysis_id_analysis_results_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analysis_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_ai_config_provider" ON "ai_configurations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_analysis_results_document" ON "analysis_results" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_analysis_results_type" ON "analysis_results" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_download_logs_document" ON "download_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_download_logs_created" ON "download_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_extracted_elements_analysis" ON "extracted_elements" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_extracted_elements_name" ON "extracted_elements" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_statistics_analysis" ON "statistics" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_tender_documents_status" ON "tender_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tender_documents_created" ON "tender_documents" USING btree ("created_at");
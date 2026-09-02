CREATE TABLE "rag_knowledge_base_files" (
	"knowledge_base_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"file_id" varchar(64) NOT NULL,
	"added_by_user_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_knowledge_base_files_knowledge_base_id_file_id_pk" PRIMARY KEY("knowledge_base_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "rag_knowledge_base_members" (
	"knowledge_base_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"role" varchar(20) DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_knowledge_base_members_knowledge_base_id_user_id_pk" PRIMARY KEY("knowledge_base_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "rag_knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_chunks_v3" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"index_id" uuid NOT NULL,
	"file_id" varchar(64) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"chunk_type" varchar(20) DEFAULT 'text' NOT NULL,
	"page_start" integer,
	"page_end" integer,
	"section_path" text,
	"extraction_method" varchar(50) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_index_job_files_v3" (
	"job_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"file_id" varchar(64) NOT NULL,
	"index_id" uuid,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"stage" varchar(30) DEFAULT 'queued' NOT NULL,
	"percent" integer DEFAULT 0 NOT NULL,
	"message" text,
	"error_code" varchar(100),
	"error_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_index_job_files_v3_job_id_file_id_pk" PRIMARY KEY("job_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "rag_index_jobs_v3" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"requested_by_user_id" varchar(64) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"force" boolean DEFAULT false NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"completed_files" integer DEFAULT 0 NOT NULL,
	"failed_files" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_indexes_v3" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"file_id" varchar(64) NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"embedding_provider" varchar(50) NOT NULL,
	"embedding_region" varchar(50) NOT NULL,
	"embedding_model" varchar(100) NOT NULL,
	"embedding_dimension" integer NOT NULL,
	"collection_name" varchar(100) NOT NULL,
	"chunking_version" varchar(50) NOT NULL,
	"index_version" varchar(100) NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" varchar(100),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_query_citations_v3" (
	"query_log_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"citation_index" integer NOT NULL,
	"score" double precision,
	CONSTRAINT "rag_query_citations_v3_query_log_id_citation_index_pk" PRIMARY KEY("query_log_id","citation_index")
);
--> statement-breakpoint
CREATE TABLE "rag_query_logs_v3" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"request_id" varchar(128) NOT NULL,
	"question" text NOT NULL,
	"refused" boolean DEFAULT false NOT NULL,
	"latency_ms" integer,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_vector_operations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rag_vector_operations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" varchar(64) NOT NULL,
	"operation_type" varchar(20) NOT NULL,
	"chunk_id" uuid,
	"index_id" uuid NOT NULL,
	"vector" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rag_knowledge_base_files" ADD CONSTRAINT "rag_knowledge_base_files_knowledge_base_id_rag_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."rag_knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_knowledge_base_members" ADD CONSTRAINT "rag_knowledge_base_members_knowledge_base_id_rag_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."rag_knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks_v3" ADD CONSTRAINT "rag_chunks_v3_index_id_rag_indexes_v3_id_fk" FOREIGN KEY ("index_id") REFERENCES "public"."rag_indexes_v3"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_index_job_files_v3" ADD CONSTRAINT "rag_index_job_files_v3_job_id_rag_index_jobs_v3_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."rag_index_jobs_v3"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_index_job_files_v3" ADD CONSTRAINT "rag_index_job_files_v3_index_id_rag_indexes_v3_id_fk" FOREIGN KEY ("index_id") REFERENCES "public"."rag_indexes_v3"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_index_jobs_v3" ADD CONSTRAINT "rag_index_jobs_v3_knowledge_base_id_rag_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."rag_knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_citations_v3" ADD CONSTRAINT "rag_query_citations_v3_query_log_id_rag_query_logs_v3_id_fk" FOREIGN KEY ("query_log_id") REFERENCES "public"."rag_query_logs_v3"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_citations_v3" ADD CONSTRAINT "rag_query_citations_v3_chunk_id_rag_chunks_v3_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."rag_chunks_v3"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs_v3" ADD CONSTRAINT "rag_query_logs_v3_knowledge_base_id_rag_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."rag_knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_vector_operations" ADD CONSTRAINT "rag_vector_operations_index_id_rag_indexes_v3_id_fk" FOREIGN KEY ("index_id") REFERENCES "public"."rag_indexes_v3"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rag_kb_file_file_idx" ON "rag_knowledge_base_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "rag_kb_file_user_kb_idx" ON "rag_knowledge_base_files" USING btree ("user_id","knowledge_base_id");--> statement-breakpoint
CREATE INDEX "rag_kb_member_user_idx" ON "rag_knowledge_base_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rag_kb_user_updated_idx" ON "rag_knowledge_bases" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rag_kb_user_name_uq" ON "rag_knowledge_bases" USING btree ("user_id",lower("name")) WHERE "rag_knowledge_bases"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rag_chunk_index_uq" ON "rag_chunks_v3" USING btree ("index_id","chunk_index");--> statement-breakpoint
CREATE INDEX "rag_chunk_file_idx" ON "rag_chunks_v3" USING btree ("user_id","file_id");--> statement-breakpoint
CREATE INDEX "rag_job_kb_status_idx" ON "rag_index_jobs_v3" USING btree ("knowledge_base_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "rag_index_identity_uq" ON "rag_indexes_v3" USING btree ("user_id","file_id","source_hash","embedding_region","embedding_model","embedding_dimension","chunking_version","index_version");--> statement-breakpoint
CREATE INDEX "rag_index_active_idx" ON "rag_indexes_v3" USING btree ("user_id","file_id","status");--> statement-breakpoint
CREATE INDEX "rag_query_citation_chunk_idx" ON "rag_query_citations_v3" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "rag_query_user_idx" ON "rag_query_logs_v3" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "rag_vector_outbox_claim_idx" ON "rag_vector_operations" USING btree ("user_id","status","available_at");
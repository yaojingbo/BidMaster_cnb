import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const knowledgeBases = pgTable('rag_knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('rag_kb_user_updated_idx').on(table.userId, table.updatedAt),
  uniqueIndex('rag_kb_user_name_uq')
    .on(table.userId, sql`lower(${table.name})`)
    .where(sql`${table.deletedAt} IS NULL`),
]);

export const knowledgeBaseMembers = pgTable('rag_knowledge_base_members', {
  knowledgeBaseId: uuid('knowledge_base_id').notNull().references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 64 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.knowledgeBaseId, table.userId] }),
  index('rag_kb_member_user_idx').on(table.userId),
]);

export const knowledgeBaseFiles = pgTable('rag_knowledge_base_files', {
  knowledgeBaseId: uuid('knowledge_base_id').notNull().references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 64 }).notNull(),
  fileId: varchar('file_id', { length: 64 }).notNull(),
  addedByUserId: varchar('added_by_user_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.knowledgeBaseId, table.fileId] }),
  index('rag_kb_file_file_idx').on(table.fileId),
  index('rag_kb_file_user_kb_idx').on(table.userId, table.knowledgeBaseId),
]);

export const ragIndexes = pgTable('rag_indexes_v3', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  fileId: varchar('file_id', { length: 64 }).notNull(),
  sourceHash: varchar('source_hash', { length: 64 }).notNull(),
  embeddingProvider: varchar('embedding_provider', { length: 50 }).notNull(),
  embeddingRegion: varchar('embedding_region', { length: 50 }).notNull(),
  embeddingModel: varchar('embedding_model', { length: 100 }).notNull(),
  embeddingDimension: integer('embedding_dimension').notNull(),
  collectionName: varchar('collection_name', { length: 100 }).notNull(),
  chunkingVersion: varchar('chunking_version', { length: 50 }).notNull(),
  indexVersion: varchar('index_version', { length: 100 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  chunkCount: integer('chunk_count').notNull().default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  ...timestamps,
}, (table) => [
  uniqueIndex('rag_index_identity_uq').on(
    table.userId,
    table.fileId,
    table.sourceHash,
    table.embeddingRegion,
    table.embeddingModel,
    table.embeddingDimension,
    table.chunkingVersion,
    table.indexVersion,
  ),
  index('rag_index_active_idx').on(table.userId, table.fileId, table.status),
]);

export const ragChunks = pgTable('rag_chunks_v3', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  indexId: uuid('index_id').notNull().references(() => ragIndexes.id, { onDelete: 'cascade' }),
  fileId: varchar('file_id', { length: 64 }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  chunkType: varchar('chunk_type', { length: 20 }).notNull().default('text'),
  pageStart: integer('page_start'),
  pageEnd: integer('page_end'),
  sectionPath: text('section_path'),
  extractionMethod: varchar('extraction_method', { length: 50 }).notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('rag_chunk_index_uq').on(table.indexId, table.chunkIndex),
  index('rag_chunk_file_idx').on(table.userId, table.fileId),
]);

export const ragIndexJobs = pgTable('rag_index_jobs_v3', {
  id: uuid('id').primaryKey().defaultRandom(),
  knowledgeBaseId: uuid('knowledge_base_id').notNull().references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  requestedByUserId: varchar('requested_by_user_id', { length: 64 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  force: boolean('force').notNull().default(false),
  totalFiles: integer('total_files').notNull().default(0),
  completedFiles: integer('completed_files').notNull().default(0),
  failedFiles: integer('failed_files').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [index('rag_job_kb_status_idx').on(table.knowledgeBaseId, table.status)]);

export const ragIndexJobFiles = pgTable('rag_index_job_files_v3', {
  jobId: uuid('job_id').notNull().references(() => ragIndexJobs.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 64 }).notNull(),
  fileId: varchar('file_id', { length: 64 }).notNull(),
  indexId: uuid('index_id').references(() => ragIndexes.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  stage: varchar('stage', { length: 30 }).notNull().default('queued'),
  percent: integer('percent').notNull().default(0),
  message: text('message'),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.jobId, table.fileId] })]);

export const ragVectorOperations = pgTable('rag_vector_operations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  operationType: varchar('operation_type', { length: 20 }).notNull(),
  chunkId: uuid('chunk_id'),
  indexId: uuid('index_id').notNull().references(() => ragIndexes.id, { onDelete: 'cascade' }),
  vector: jsonb('vector'),
  metadata: jsonb('metadata').notNull().default({}),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('rag_vector_outbox_claim_idx').on(table.userId, table.status, table.availableAt)]);

export const ragQueryLogs = pgTable('rag_query_logs_v3', {
  id: uuid('id').primaryKey().defaultRandom(),
  knowledgeBaseId: uuid('knowledge_base_id').notNull().references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 64 }).notNull(),
  requestId: varchar('request_id', { length: 128 }).notNull(),
  question: text('question').notNull(),
  refused: boolean('refused').notNull().default(false),
  latencyMs: integer('latency_ms'),
  usage: jsonb('usage').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('rag_query_user_idx').on(table.userId, table.createdAt)]);

export const ragQueryCitations = pgTable('rag_query_citations_v3', {
  queryLogId: uuid('query_log_id').notNull().references(() => ragQueryLogs.id, { onDelete: 'cascade' }),
  chunkId: uuid('chunk_id').notNull().references(() => ragChunks.id, { onDelete: 'restrict' }),
  citationIndex: integer('citation_index').notNull(),
  score: doublePrecision('score'),
}, (table) => [
  primaryKey({ columns: [table.queryLogId, table.citationIndex] }),
  index('rag_query_citation_chunk_idx').on(table.chunkId),
]);

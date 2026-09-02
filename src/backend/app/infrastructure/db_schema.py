"""
PostgreSQL schema initialization.

当前数据库 schema 的唯一权威来源是本文件；Drizzle schema 仅对齐真实表结构，不能作为迁移入口。
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import get_settings


CORE_SCHEMA_SQL = """
-- 极旧结构迁移：users.id 为 VARCHAR(8) 时重建业务表。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'id'
        AND character_maximum_length = 8
    ) THEN
        DROP TABLE IF EXISTS reset_tokens CASCADE;
        DROP TABLE IF EXISTS verification_codes CASCADE;
        DROP TABLE IF EXISTS api_keys CASCADE;
        DROP TABLE IF EXISTS extracts CASCADE;
        DROP TABLE IF EXISTS openings CASCADE;
        DROP TABLE IF EXISTS simulates CASCADE;
        DROP TABLE IF EXISTS files CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
    END IF;
END $$;

-- 旧 files 结构迁移。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'files'
    ) AND (
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'files' AND column_name = 'file_type'
        ) OR NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'files' AND column_name = 'user_id'
        )
    ) THEN
        DROP TABLE IF EXISTS extracts CASCADE;
        DROP TABLE IF EXISTS openings CASCADE;
        DROP TABLE IF EXISTS simulates CASCADE;
        DROP TABLE IF EXISTS files CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(64) PRIMARY KEY,
    original_name TEXT NOT NULL,
    path TEXT NOT NULL,
    size BIGINT DEFAULT 0,
    type VARCHAR(50),
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    encrypted_content BYTEA,
    file_hash VARCHAR(64),
    parent_file_id VARCHAR(64) REFERENCES files(id) ON DELETE CASCADE,
    archive_entry_path TEXT,
    managed_by VARCHAR(30),
    visibility VARCHAR(20) NOT NULL DEFAULT 'normal',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS simulates (
    task_id VARCHAR(64) PRIMARY KEY,
    name TEXT,
    status VARCHAR(30) DEFAULT 'pending',
    source_hash TEXT,
    current_step INT DEFAULT 0,
    params JSONB DEFAULT '{}',
    step_results JSONB DEFAULT '{}',
    file_ids JSONB DEFAULT '[]',
    files JSONB DEFAULT '[]',
    file_names JSONB DEFAULT '[]',
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS openings (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT,
    file_id VARCHAR(64),
    file_name TEXT,
    meta JSONB DEFAULT '{}',
    bidder_count INT DEFAULT 0,
    bid_ranking JSONB DEFAULT '[]',
    bid_stats JSONB DEFAULT '{}',
    ai_analysis TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    source_hash TEXT,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS extracts (
    id VARCHAR(64) PRIMARY KEY,
    name TEXT,
    file_id TEXT,
    file_name TEXT,
    template_type VARCHAR(50),
    mode VARCHAR(20),
    content TEXT,
    elements JSONB DEFAULT '[]',
    status VARCHAR(30) DEFAULT 'completed',
    source_hash TEXT,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 已有表增量迁移必须在基础表创建后执行。
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'files' AND column_name = 'encrypted_content'
       ) THEN
        ALTER TABLE files ADD COLUMN encrypted_content BYTEA;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'files')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'files' AND column_name = 'file_hash'
       ) THEN
        ALTER TABLE files ADD COLUMN file_hash VARCHAR(64);
    END IF;
    ALTER TABLE files ADD COLUMN IF NOT EXISTS parent_file_id VARCHAR(64) REFERENCES files(id) ON DELETE CASCADE;
    ALTER TABLE files ADD COLUMN IF NOT EXISTS archive_entry_path TEXT;
    ALTER TABLE files ADD COLUMN IF NOT EXISTS managed_by VARCHAR(30);
    ALTER TABLE files ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'normal';
    ALTER TABLE files ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'simulates' AND column_name = 'status'
        AND character_maximum_length = 20
    ) THEN
        ALTER TABLE simulates ALTER COLUMN status TYPE VARCHAR(30);
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'extracts' AND column_name = 'file_id'
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE extracts ALTER COLUMN file_id TYPE TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extracts')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'extracts' AND column_name = 'status'
       ) THEN
        ALTER TABLE extracts ADD COLUMN status VARCHAR(30) DEFAULT 'completed';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extracts')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'extracts' AND column_name = 'source_hash'
       ) THEN
        ALTER TABLE extracts ADD COLUMN source_hash TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'openings')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'openings' AND column_name = 'ai_analysis'
       ) THEN
        ALTER TABLE openings ADD COLUMN ai_analysis TEXT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'openings')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'openings' AND column_name = 'status'
       ) THEN
        ALTER TABLE openings ADD COLUMN status VARCHAR(20) DEFAULT 'completed';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'openings')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'openings' AND column_name = 'source_hash'
       ) THEN
        ALTER TABLE openings ADD COLUMN source_hash TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'simulates')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'simulates' AND column_name = 'source_hash'
       ) THEN
        ALTER TABLE simulates ADD COLUMN source_hash TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_sources (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    url TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    region VARCHAR(100) DEFAULT '',
    tags JSONB DEFAULT '[]',
    note TEXT DEFAULT '',
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_visited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_sources_user ON project_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_project_sources_user_category ON project_sources(user_id, category);
CREATE INDEX IF NOT EXISTS idx_project_sources_user_region ON project_sources(user_id, region);
CREATE INDEX IF NOT EXISTS idx_project_sources_user_favorite ON project_sources(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_project_sources_user_updated ON project_sources(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS api_keys (
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    encrypted_key TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS verification_codes (
    email VARCHAR(255) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS reset_tokens (
    token VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS cli_device_codes (
    device_code TEXT PRIMARY KEY,
    user_code VARCHAR(16) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    authorized_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS knowledge_bases (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_knowledge_bases_user_name
ON knowledge_bases(user_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_updated
ON knowledge_bases(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_sources (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(40) NOT NULL,
    source_variant VARCHAR(50) NOT NULL DEFAULT '',
    provenance_type VARCHAR(40) NOT NULL,
    display_name TEXT NOT NULL,
    media_type VARCHAR(100),
    content_hash VARCHAR(64) NOT NULL,
    storage_file_id VARCHAR(64) REFERENCES files(id) ON DELETE SET NULL,
    source_ref_id VARCHAR(64),
    parent_source_id VARCHAR(64) REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    source_locator JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'ready',
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_knowledge_source_ref
ON knowledge_sources(user_id, source_type, source_ref_id, source_variant)
WHERE source_ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_user_created
ON knowledge_sources(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_storage_file
ON knowledge_sources(storage_file_id);

CREATE TABLE IF NOT EXISTS knowledge_base_sources (
    knowledge_base_id VARCHAR(64) NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    source_id VARCHAR(64) NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (knowledge_base_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_sources_user
ON knowledge_base_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_sources_source
ON knowledge_base_sources(source_id);

CREATE TABLE IF NOT EXISTS knowledge_base_files (
    knowledge_base_id VARCHAR(64) NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    file_id VARCHAR(64) NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (knowledge_base_id, file_id)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_files_user
ON knowledge_base_files(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_files_file
ON knowledge_base_files(file_id);

CREATE TABLE IF NOT EXISTS rag_indexes (
    id VARCHAR(64) PRIMARY KEY,
    file_id VARCHAR(64) REFERENCES files(id) ON DELETE CASCADE,
    source_id VARCHAR(64) REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_hash VARCHAR(64) NOT NULL,
    embedding_provider VARCHAR(50) NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    embedding_dimension INT NOT NULL,
    chunking_version VARCHAR(50) NOT NULL,
    index_version VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    chunk_count INT NOT NULL DEFAULT 0,
    attempt_count INT NOT NULL DEFAULT 0,
    error_code VARCHAR(100),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rag_index_version
ON rag_indexes(file_id, user_id, source_hash, embedding_provider, embedding_model,
               embedding_dimension, chunking_version, index_version);
CREATE INDEX IF NOT EXISTS idx_rag_indexes_user_file_status
ON rag_indexes(user_id, file_id, status);

CREATE TABLE IF NOT EXISTS rag_index_jobs (
    id VARCHAR(64) PRIMARY KEY,
    knowledge_base_id VARCHAR(64) NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_file_ids JSONB NOT NULL DEFAULT '[]',
    requested_source_ids JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    total_item_count INT NOT NULL DEFAULT 0,
    completed_file_count INT NOT NULL DEFAULT 0,
    failed_file_count INT NOT NULL DEFAULT 0,
    skipped_item_count INT NOT NULL DEFAULT 0,
    current_stage VARCHAR(40),
    current_item_id VARCHAR(64),
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    progress_message TEXT,
    error_message TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    worker_id VARCHAR(100),
    lease_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_rag_index_jobs_user_kb
ON rag_index_jobs(user_id, knowledge_base_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rag_index_job_items (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL REFERENCES rag_index_jobs(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id VARCHAR(64) REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    file_id VARCHAR(64) REFERENCES files(id) ON DELETE CASCADE,
    parent_item_id VARCHAR(64) REFERENCES rag_index_job_items(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL DEFAULT 'source',
    display_name TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    current_stage VARCHAR(40) NOT NULL DEFAULT 'validating',
    stage_progress NUMERIC(5,2) NOT NULL DEFAULT 0,
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    completed_units INT NOT NULL DEFAULT 0,
    total_units INT NOT NULL DEFAULT 0,
    weight_units NUMERIC(10,2) NOT NULL DEFAULT 1,
    index_id VARCHAR(64) REFERENCES rag_indexes(id) ON DELETE SET NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    error_code VARCHAR(100),
    error_message TEXT,
    progress_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    heartbeat_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_rag_index_job_items_job
ON rag_index_job_items(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rag_index_job_items_recovery
ON rag_index_job_items(status, heartbeat_at, updated_at);

-- 已有知识库表增量升级。
ALTER TABLE rag_indexes ADD COLUMN IF NOT EXISTS source_id VARCHAR(64) REFERENCES knowledge_sources(id) ON DELETE CASCADE;
ALTER TABLE rag_indexes ALTER COLUMN file_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_indexes_user_source_status
ON rag_indexes(user_id, source_id, status);
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS requested_source_ids JSONB NOT NULL DEFAULT '[]';
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS total_item_count INT NOT NULL DEFAULT 0;
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS skipped_item_count INT NOT NULL DEFAULT 0;
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS current_stage VARCHAR(40);
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS current_item_id VARCHAR(64);
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS progress_message TEXT;
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS worker_id VARCHAR(100);
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE rag_index_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS rag_query_logs (
    id VARCHAR(64) PRIMARY KEY,
    knowledge_base_id VARCHAR(64) NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    selected_file_ids JSONB NOT NULL DEFAULT '[]',
    retrieved_chunk_ids JSONB NOT NULL DEFAULT '[]',
    cited_file_ids JSONB NOT NULL DEFAULT '[]',
    chat_provider VARCHAR(50),
    chat_model VARCHAR(100),
    latency_ms INT,
    token_usage JSONB NOT NULL DEFAULT '{}',
    refused BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_user_kb
ON rag_query_logs(user_id, knowledge_base_id, created_at DESC);
"""

RAG_VECTOR_SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS rag_chunks (
    id VARCHAR(64) PRIMARY KEY,
    index_id VARCHAR(64) NOT NULL REFERENCES rag_indexes(id) ON DELETE CASCADE,
    file_id VARCHAR(64) REFERENCES files(id) ON DELETE CASCADE,
    source_id VARCHAR(64) REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_type VARCHAR(30) NOT NULL DEFAULT 'text',
    section_path TEXT,
    page_start INT,
    page_end INT,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    extraction_method VARCHAR(50),
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding vector(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_file
ON rag_chunks(user_id, file_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_index
ON rag_chunks(index_id, chunk_index);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rag_chunk_hash
ON rag_chunks(index_id, content_hash);
ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS source_id VARCHAR(64) REFERENCES knowledge_sources(id) ON DELETE CASCADE;
ALTER TABLE rag_chunks ALTER COLUMN file_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_chunks_user_source
ON rag_chunks(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_content_trgm
ON rag_chunks USING gin (content gin_trgm_ops);
"""

# 兼容仍引用旧常量的代码和测试；核心 schema 不依赖 pgvector。
SCHEMA_SQL = CORE_SCHEMA_SQL


@dataclass(frozen=True)
class RagDatabaseCapability:
    ready: bool
    reason: str | None = None


_rag_database_capability = RagDatabaseCapability(False, "尚未初始化")


def get_rag_database_capability() -> RagDatabaseCapability:
    return _rag_database_capability


async def init_schema(db) -> None:
    """初始化核心表，并按配置独立初始化知识库向量能力。"""
    global _rag_database_capability

    await db.execute(CORE_SCHEMA_SQL)
    settings = get_settings()
    if not settings.knowledge_base_enabled:
        _rag_database_capability = RagDatabaseCapability(False, "知识库功能已关闭")
        return

    if settings.rag_embedding_model != "text-embedding-v4" or settings.rag_embedding_dimension != 1024:
        message = "首期 RAG 仅支持 text-embedding-v4 和 1024 维向量"
        _rag_database_capability = RagDatabaseCapability(False, message)
        if settings.rag_required:
            raise RuntimeError(message)
        return

    try:
        await db.execute(RAG_VECTOR_SCHEMA_SQL)
        await db.register_vector_codec()
        row = await db.fetch_one(
            """SELECT
                   EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS vector_ready,
                   EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS trgm_ready"""
        )
        if not row or not row.get("vector_ready") or not row.get("trgm_ready"):
            raise RuntimeError("数据库缺少 vector 或 pg_trgm 扩展")
        _rag_database_capability = RagDatabaseCapability(True)
    except Exception as exc:
        _rag_database_capability = RagDatabaseCapability(False, str(exc))
        if settings.rag_required:
            raise

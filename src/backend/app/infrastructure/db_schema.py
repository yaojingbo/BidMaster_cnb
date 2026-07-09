"""
PostgreSQL schema initialization.

当前数据库 schema 的唯一权威来源是本文件中的 SCHEMA_SQL；Drizzle schema 仅对齐这里的真实表结构，不能作为迁移入口。
"""

SCHEMA_SQL = """
-- 迁移 1：如果 users.id 是 VARCHAR(8)，说明是极旧版本，全部重建
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

-- 迁移 2：如果 files 表使用旧 schema（file_type 列或缺少 user_id），重建 files 及依赖表
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'files'
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

-- 迁移 3：如果 files 表缺少 encrypted_content 列，添加它
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'files' AND column_name = 'encrypted_content'
    ) THEN
        ALTER TABLE files ADD COLUMN encrypted_content BYTEA;
    END IF;
END $$;

-- 迁移 4：simulates.status VARCHAR(20) → VARCHAR(30)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'simulates' AND column_name = 'status'
        AND character_maximum_length = 20
    ) THEN
        ALTER TABLE simulates ALTER COLUMN status TYPE VARCHAR(30);
    END IF;
END $$;

-- 迁移 5：extracts.file_id VARCHAR(64) → TEXT（批量模式存逗号拼接的多文件ID）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'extracts' AND column_name = 'file_id'
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE extracts ALTER COLUMN file_id TYPE TEXT;
    END IF;
END $$;

-- 迁移 6：extracts 添加 status 列
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'extracts' AND column_name = 'status'
    ) THEN
        ALTER TABLE extracts ADD COLUMN status VARCHAR(30) DEFAULT 'completed';
    END IF;
END $$;

-- 迁移 7：openings 添加 ai_analysis 和 status 列
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'openings' AND column_name = 'ai_analysis'
    ) THEN
        ALTER TABLE openings ADD COLUMN ai_analysis TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'openings' AND column_name = 'status'
    ) THEN
        ALTER TABLE openings ADD COLUMN status VARCHAR(20) DEFAULT 'completed';
    END IF;
END $$;

-- 迁移 8：添加源文件指纹，用于安全复用历史分析结果
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'files' AND column_name = 'file_hash'
    ) THEN
        ALTER TABLE files ADD COLUMN file_hash VARCHAR(64);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'extracts' AND column_name = 'source_hash'
    ) THEN
        ALTER TABLE extracts ADD COLUMN source_hash TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'openings' AND column_name = 'source_hash'
    ) THEN
        ALTER TABLE openings ADD COLUMN source_hash TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'simulates' AND column_name = 'source_hash'
    ) THEN
        ALTER TABLE simulates ADD COLUMN source_hash TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(64) PRIMARY KEY,
    original_name TEXT NOT NULL,
    path TEXT NOT NULL,
    size BIGINT DEFAULT 0,
    type VARCHAR(50),
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    encrypted_content BYTEA,
    file_hash VARCHAR(64),
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
"""


async def init_schema(db) -> None:
    """Execute schema creation on the given Database instance."""
    await db.execute(SCHEMA_SQL)

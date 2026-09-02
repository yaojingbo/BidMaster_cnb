from app.infrastructure.db_schema import CORE_SCHEMA_SQL, RAG_VECTOR_SCHEMA_SQL


def test_core_schema_creates_files_before_incremental_alter():
    create_position = CORE_SCHEMA_SQL.index("CREATE TABLE IF NOT EXISTS files")
    alter_position = CORE_SCHEMA_SQL.index("ALTER TABLE files ADD COLUMN encrypted_content")
    assert create_position < alter_position


def test_rag_schema_requires_both_extensions_and_fixed_dimension():
    assert "CREATE EXTENSION IF NOT EXISTS vector" in RAG_VECTOR_SCHEMA_SQL
    assert "CREATE EXTENSION IF NOT EXISTS pg_trgm" in RAG_VECTOR_SCHEMA_SQL
    assert "embedding vector(1024)" in RAG_VECTOR_SCHEMA_SQL

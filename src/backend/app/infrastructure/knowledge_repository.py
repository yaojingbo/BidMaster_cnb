"""知识库资源的 PostgreSQL 仓储。"""
from __future__ import annotations

import uuid

from app.config import get_settings
from app.infrastructure.database import Database, get_database
from app.infrastructure.pg_storage import _serialize_row, _serialize_rows


class KnowledgeRepository:
    def __init__(self, db: Database):
        self.db = db
        settings = get_settings()
        self.index_config = (
            settings.rag_embedding_provider,
            settings.rag_embedding_model,
            settings.rag_embedding_dimension,
            settings.rag_chunking_version,
            settings.rag_index_version,
        )

    async def create(self, user_id: str, name: str, description: str) -> dict:
        row = await self.db.fetch_one(
            """INSERT INTO knowledge_bases (id, user_id, name, description)
               VALUES ($1, $2, $3, $4)
               RETURNING *""",
            str(uuid.uuid4()), user_id, name, description,
        )
        return _serialize_row(row) or {}

    async def list(self, user_id: str, search: str = "") -> list[dict]:
        rows = await self.db.fetch_all(
            """SELECT kb.*,
                      COUNT(kbf.file_id)::int AS file_count,
                      COUNT(*) FILTER (WHERE ri.status = 'completed')::int AS completed_count,
                      COUNT(*) FILTER (WHERE ri.status IN ('pending','processing'))::int AS processing_count,
                      COUNT(*) FILTER (WHERE ri.status = 'failed')::int AS failed_count,
                      COUNT(*) FILTER (WHERE ri.status = 'stale')::int AS stale_count
               FROM knowledge_bases kb
               LEFT JOIN knowledge_base_files kbf
                 ON kbf.knowledge_base_id = kb.id AND kbf.user_id = kb.user_id
               LEFT JOIN LATERAL (
                   SELECT status FROM rag_indexes
                   WHERE user_id = kb.user_id AND file_id = kbf.file_id
                     AND embedding_provider=$3 AND embedding_model=$4 AND embedding_dimension=$5
                     AND chunking_version=$6 AND index_version=$7
                   ORDER BY created_at DESC LIMIT 1
               ) ri ON TRUE
               WHERE kb.user_id = $1 AND ($2 = '' OR kb.name ILIKE '%' || $2 || '%')
               GROUP BY kb.id
               ORDER BY kb.updated_at DESC""",
            user_id, search, *self.index_config,
        )
        return _serialize_rows(rows)

    async def get(self, knowledge_base_id: str, user_id: str) -> dict | None:
        row = await self.db.fetch_one(
            "SELECT * FROM knowledge_bases WHERE id = $1 AND user_id = $2",
            knowledge_base_id, user_id,
        )
        return _serialize_row(row)

    async def update(self, knowledge_base_id: str, user_id: str, name: str, description: str) -> dict | None:
        row = await self.db.fetch_one(
            """UPDATE knowledge_bases SET name = $3, description = $4, updated_at = NOW()
               WHERE id = $1 AND user_id = $2 RETURNING *""",
            knowledge_base_id, user_id, name, description,
        )
        return _serialize_row(row)

    async def delete(self, knowledge_base_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            "DELETE FROM knowledge_bases WHERE id = $1 AND user_id = $2",
            knowledge_base_id, user_id,
        )
        return "DELETE 1" in result

    async def add_files(self, knowledge_base_id: str, user_id: str, file_ids: list[str]) -> list[str]:
        from app.infrastructure.knowledge_source_repository import KnowledgeSourceRepository

        rows = await self.db.fetch_all(
            "SELECT id FROM files WHERE user_id = $1 AND id = ANY($2::varchar[])",
            user_id, file_ids,
        )
        allowed = [row["id"] for row in rows]
        source_repository = KnowledgeSourceRepository(self.db)
        for file_id in allowed:
            await self.db.execute(
                """INSERT INTO knowledge_base_files (knowledge_base_id, file_id, user_id)
                   SELECT $1::varchar, $2::varchar, $3::varchar
                   WHERE EXISTS (
                       SELECT 1 FROM knowledge_bases
                       WHERE id = $1::varchar AND user_id = $3::varchar
                   )
                   ON CONFLICT DO NOTHING""",
                knowledge_base_id, file_id, user_id,
            )
            source = await source_repository.ensure_file_source(file_id, user_id)
            if source:
                await source_repository.add_to_knowledge_base(knowledge_base_id, [source["id"]], user_id)
        if allowed:
            await self.db.execute(
                "UPDATE knowledge_bases SET updated_at = NOW() WHERE id = $1 AND user_id = $2",
                knowledge_base_id, user_id,
            )
        return allowed

    async def remove_file(self, knowledge_base_id: str, file_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            """DELETE FROM knowledge_base_files
               WHERE knowledge_base_id = $1 AND file_id = $2 AND user_id = $3""",
            knowledge_base_id, file_id, user_id,
        )
        return "DELETE 1" in result

    async def list_files(self, knowledge_base_id: str, user_id: str) -> list[dict]:
        rows = await self.db.fetch_all(
            """SELECT f.id, f.original_name, f.size, f.type, f.file_hash, f.created_at,
                      COALESCE(ri.status, 'not_indexed') AS index_status,
                      COALESCE(ri.chunk_count, 0) AS chunk_count,
                      ri.error_message, ri.id AS index_id, ri.updated_at AS index_updated_at
               FROM knowledge_base_files kbf
               JOIN files f ON f.id = kbf.file_id AND f.user_id = kbf.user_id
               LEFT JOIN LATERAL (
                   SELECT id, status, chunk_count, error_message, updated_at
                   FROM rag_indexes
                   WHERE user_id = $2 AND file_id = f.id
                     AND embedding_provider=$3 AND embedding_model=$4 AND embedding_dimension=$5
                     AND chunking_version=$6 AND index_version=$7
                   ORDER BY created_at DESC LIMIT 1
               ) ri ON TRUE
               WHERE kbf.knowledge_base_id = $1 AND kbf.user_id = $2
               ORDER BY kbf.added_at DESC""",
            knowledge_base_id, user_id, *self.index_config,
        )
        return _serialize_rows(rows)

    async def validate_member_files(self, knowledge_base_id: str, user_id: str, file_ids: list[str] | None) -> list[dict]:
        rows = await self.list_files(knowledge_base_id, user_id)
        if file_ids is None:
            return rows
        allowed = set(file_ids)
        return [row for row in rows if row["id"] in allowed]


async def get_knowledge_repository() -> KnowledgeRepository:
    return KnowledgeRepository(await get_database())

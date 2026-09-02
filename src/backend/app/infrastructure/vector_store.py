"""PostgreSQL + pgvector 混合检索实现。"""
from __future__ import annotations

from collections import defaultdict
from typing import Protocol

from app.config import get_settings
from app.infrastructure.database import Database, get_database
from app.infrastructure.pg_storage import _serialize_rows


class VectorStoreProtocol(Protocol):
    async def vector_search(self, user_id: str, file_ids: list[str], vector: list[float], limit: int) -> list[dict]: ...
    async def keyword_search(self, user_id: str, file_ids: list[str], query: str, limit: int) -> list[dict]: ...


class PostgresVectorStore:
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

    async def vector_search(self, user_id: str, file_ids: list[str], vector: list[float], limit: int) -> list[dict]:
        rows = await self.db.fetch_all(
            """SELECT rc.id,rc.index_id,rc.file_id,f.original_name AS file_name,rc.chunk_index,
                      rc.content,rc.content_hash,rc.chunk_type,rc.page_start,rc.page_end,
                      rc.section_path,rc.extraction_method,rc.metadata,
                      1 - (rc.embedding <=> $3) AS score
               FROM rag_chunks rc
               JOIN files f ON f.id=rc.file_id AND f.user_id=rc.user_id
               JOIN rag_indexes ri ON ri.id=rc.index_id AND ri.user_id=rc.user_id
               WHERE rc.user_id=$1 AND rc.file_id=ANY($2::varchar[]) AND ri.status='completed'
                 AND ri.embedding_provider=$5 AND ri.embedding_model=$6 AND ri.embedding_dimension=$7
                 AND ri.chunking_version=$8 AND ri.index_version=$9
               ORDER BY rc.embedding <=> $3 LIMIT $4""",
            user_id, file_ids, vector, limit, *self.index_config,
        )
        return _serialize_rows(rows)

    async def keyword_search(self, user_id: str, file_ids: list[str], query: str, limit: int) -> list[dict]:
        rows = await self.db.fetch_all(
            """SELECT rc.id,rc.index_id,rc.file_id,f.original_name AS file_name,rc.chunk_index,
                      rc.content,rc.content_hash,rc.chunk_type,rc.page_start,rc.page_end,
                      rc.section_path,rc.extraction_method,rc.metadata,
                      GREATEST(similarity(rc.content,$3), CASE WHEN rc.content ILIKE '%'||$3||'%' THEN 1.0 ELSE 0.0 END) AS score
               FROM rag_chunks rc
               JOIN files f ON f.id=rc.file_id AND f.user_id=rc.user_id
               JOIN rag_indexes ri ON ri.id=rc.index_id AND ri.user_id=rc.user_id
               WHERE rc.user_id=$1 AND rc.file_id=ANY($2::varchar[]) AND ri.status='completed'
                 AND ri.embedding_provider=$5 AND ri.embedding_model=$6 AND ri.embedding_dimension=$7
                 AND ri.chunking_version=$8 AND ri.index_version=$9
                 AND (rc.content % $3 OR rc.content ILIKE '%'||$3||'%')
               ORDER BY score DESC LIMIT $4""",
            user_id, file_ids, query, limit, *self.index_config,
        )
        return _serialize_rows(rows)


def reciprocal_rank_fusion(vector_rows: list[dict], keyword_rows: list[dict], rrf_k: int = 60) -> list[dict]:
    merged: dict[str, dict] = {}
    scores: defaultdict[str, float] = defaultdict(float)
    for rows in (vector_rows, keyword_rows):
        for rank, row in enumerate(rows, 1):
            chunk_id = row["id"]
            merged.setdefault(chunk_id, dict(row))
            scores[chunk_id] += 1 / (rrf_k + rank)
    for chunk_id, row in merged.items():
        row["score"] = scores[chunk_id]
    return sorted(merged.values(), key=lambda row: row["score"], reverse=True)


async def get_vector_store() -> PostgresVectorStore:
    return PostgresVectorStore(await get_database())

"""统一知识源及知识库成员仓储。"""
from __future__ import annotations

import json
import uuid

from app.infrastructure.database import Database
from app.infrastructure.pg_storage import _serialize_row, _serialize_rows


class KnowledgeSourceRepository:
    def __init__(self, db: Database):
        self.db = db

    async def ensure_file_source(self, file_id: str, user_id: str) -> dict | None:
        row = await self.db.fetch_one(
            """INSERT INTO knowledge_sources
               (id,user_id,source_type,source_variant,provenance_type,display_name,media_type,
                content_hash,storage_file_id,source_ref_id,source_locator,metadata)
               SELECT $1,f.user_id,'file','file.original','original',f.original_name,f.type,
                      COALESCE(f.file_hash,f.id),f.id,f.id,'{}'::jsonb,'{}'::jsonb
               FROM files f WHERE f.id=$2 AND f.user_id=$3
               ON CONFLICT (user_id,source_type,source_ref_id,source_variant)
               WHERE source_ref_id IS NOT NULL
               DO UPDATE SET display_name=EXCLUDED.display_name,content_hash=EXCLUDED.content_hash,
                             storage_file_id=EXCLUDED.storage_file_id,updated_at=NOW()
               RETURNING *""",
            str(uuid.uuid4()), file_id, user_id,
        )
        return _serialize_row(row)

    async def create(self, record: dict, user_id: str) -> dict:
        row = await self.db.fetch_one(
            """INSERT INTO knowledge_sources
               (id,user_id,source_type,source_variant,provenance_type,display_name,media_type,
                content_hash,storage_file_id,source_ref_id,parent_source_id,source_locator,metadata,status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14)
               ON CONFLICT (user_id,source_type,source_ref_id,source_variant)
               WHERE source_ref_id IS NOT NULL
               DO UPDATE SET display_name=EXCLUDED.display_name,content_hash=EXCLUDED.content_hash,
                             source_locator=EXCLUDED.source_locator,metadata=EXCLUDED.metadata,
                             status=EXCLUDED.status,updated_at=NOW()
               RETURNING *""",
            record.get("id", str(uuid.uuid4())), user_id, record["source_type"],
            record.get("source_variant", ""), record["provenance_type"], record["display_name"],
            record.get("media_type"), record["content_hash"], record.get("storage_file_id"),
            record.get("source_ref_id"), record.get("parent_source_id"),
            json.dumps(record.get("source_locator", {}), ensure_ascii=False),
            json.dumps(record.get("metadata", {}), ensure_ascii=False), record.get("status", "ready"),
        )
        return _serialize_row(row) or {}

    async def get(self, source_id: str, user_id: str) -> dict | None:
        return _serialize_row(await self.db.fetch_one(
            "SELECT * FROM knowledge_sources WHERE id=$1 AND user_id=$2", source_id, user_id,
        ))

    async def add_to_knowledge_base(self, knowledge_base_id: str, source_ids: list[str], user_id: str) -> list[str]:
        added: list[str] = []
        for source_id in source_ids:
            result = await self.db.execute(
                """INSERT INTO knowledge_base_sources (knowledge_base_id,source_id,user_id)
                   SELECT $1::varchar,$2::varchar,$3::varchar
                   WHERE EXISTS (SELECT 1 FROM knowledge_bases WHERE id=$1::varchar AND user_id=$3::varchar)
                     AND EXISTS (SELECT 1 FROM knowledge_sources WHERE id=$2::varchar AND user_id=$3::varchar)
                   ON CONFLICT DO NOTHING""",
                knowledge_base_id, source_id, user_id,
            )
            if "INSERT 0 1" in result:
                added.append(source_id)
        return added

    async def list_members(self, knowledge_base_id: str, user_id: str) -> list[dict]:
        return _serialize_rows(await self.db.fetch_all(
            """SELECT ks.*,COALESCE(ri.status,'not_indexed') AS index_status,
                      COALESCE(ri.chunk_count,0) AS chunk_count,ri.id AS index_id,ri.error_message
               FROM knowledge_base_sources kbs
               JOIN knowledge_sources ks ON ks.id=kbs.source_id AND ks.user_id=kbs.user_id
               LEFT JOIN LATERAL (
                   SELECT id,status,chunk_count,error_message FROM rag_indexes
                   WHERE user_id=$2 AND source_id=ks.id ORDER BY created_at DESC LIMIT 1
               ) ri ON TRUE
               WHERE kbs.knowledge_base_id=$1 AND kbs.user_id=$2
               ORDER BY kbs.added_at DESC""",
            knowledge_base_id, user_id,
        ))

    async def remove_member(self, knowledge_base_id: str, source_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            "DELETE FROM knowledge_base_sources WHERE knowledge_base_id=$1 AND source_id=$2 AND user_id=$3",
            knowledge_base_id, source_id, user_id,
        )
        return "DELETE 1" in result

    async def validate_members(self, knowledge_base_id: str, source_ids: list[str], user_id: str) -> list[dict]:
        if not source_ids:
            return []
        return _serialize_rows(await self.db.fetch_all(
            """SELECT ks.* FROM knowledge_base_sources kbs
               JOIN knowledge_sources ks ON ks.id=kbs.source_id AND ks.user_id=kbs.user_id
               WHERE kbs.knowledge_base_id=$1 AND kbs.user_id=$2 AND ks.id=ANY($3::varchar[])""",
            knowledge_base_id, user_id, source_ids,
        ))

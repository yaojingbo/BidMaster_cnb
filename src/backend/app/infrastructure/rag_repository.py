"""RAG 索引、任务、片段和查询日志仓储。"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.infrastructure.database import Database, get_database
from app.infrastructure.pg_storage import _serialize_row, _serialize_rows


class RagRepository:
    def __init__(self, db: Database):
        self.db = db

    async def find_reusable_index(self, user_id: str, file_id: str, source_hash: str, config: dict) -> dict | None:
        row = await self.db.fetch_one(
            """SELECT * FROM rag_indexes
               WHERE user_id=$1 AND file_id=$2 AND source_hash=$3
                 AND embedding_provider=$4 AND embedding_model=$5 AND embedding_dimension=$6
                 AND chunking_version=$7 AND index_version=$8 AND status='completed'
               ORDER BY completed_at DESC LIMIT 1""",
            user_id, file_id, source_hash, config["provider"], config["model"], config["dimension"],
            config["chunking_version"], config["index_version"],
        )
        return _serialize_row(row)

    async def get_index(self, index_id: str, user_id: str) -> dict | None:
        return _serialize_row(await self.db.fetch_one(
            "SELECT * FROM rag_indexes WHERE id=$1 AND user_id=$2",
            index_id, user_id,
        ))

    async def get_active_index(self, user_id: str, file_id: str) -> dict | None:
        row = await self.db.fetch_one(
            """SELECT * FROM rag_indexes WHERE user_id=$1 AND file_id=$2
               ORDER BY (status='completed') DESC, created_at DESC LIMIT 1""",
            user_id, file_id,
        )
        return _serialize_row(row)

    async def create_index(self, user_id: str, file_id: str, source_hash: str, config: dict, force: bool = False) -> dict:
        index_id = str(uuid.uuid4())
        effective_version = config["index_version"]
        if force:
            effective_version = f"{effective_version}:force:{index_id}"
        row = await self.db.fetch_one(
            """INSERT INTO rag_indexes
               (id,file_id,user_id,source_hash,embedding_provider,embedding_model,embedding_dimension,
                chunking_version,index_version,status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
               ON CONFLICT (file_id,user_id,source_hash,embedding_provider,embedding_model,
                            embedding_dimension,chunking_version,index_version)
               DO UPDATE SET status=CASE
                                 WHEN $10 OR rag_indexes.status='failed' THEN 'pending'::varchar
                                 ELSE rag_indexes.status
                               END,
                             error_code=NULL,error_message=NULL,updated_at=NOW(),
                             started_at=CASE
                               WHEN $10 OR rag_indexes.status='failed' THEN NULL
                               ELSE rag_indexes.started_at
                             END,
                             heartbeat_at=CASE
                               WHEN $10 OR rag_indexes.status='failed' THEN NULL
                               ELSE rag_indexes.heartbeat_at
                             END,
                             completed_at=CASE
                               WHEN $10 OR rag_indexes.status='failed' THEN NULL
                               ELSE rag_indexes.completed_at
                             END
               RETURNING *""",
            index_id, file_id, user_id, source_hash, config["provider"], config["model"], config["dimension"],
            config["chunking_version"], effective_version, force,
        )
        return _serialize_row(row) or {}

    async def create_job(self, knowledge_base_id: str, user_id: str, file_ids: list[str]) -> dict:
        row = await self.db.fetch_one(
            """INSERT INTO rag_index_jobs
               (id,knowledge_base_id,user_id,requested_file_ids,total_item_count,current_stage,progress_message)
               VALUES ($1,$2,$3,$4::jsonb,$5,'validating','正在校验索引任务') RETURNING *""",
            str(uuid.uuid4()), knowledge_base_id, user_id, json.dumps(file_ids), len(file_ids),
        )
        return _serialize_row(row) or {}

    async def delete_job(self, job_id: str, user_id: str) -> None:
        await self.db.execute(
            "DELETE FROM rag_index_jobs WHERE id=$1 AND user_id=$2",
            job_id, user_id,
        )

    async def fail_unfinished_job_items(self, job_id: str, user_id: str, message: str) -> None:
        await self.db.execute(
            """UPDATE rag_index_job_items
               SET status='failed',current_stage='failed',progress_percent=100,
                   error_code='INDEX_JOB_FAILED',error_message=$3,progress_message='索引任务异常终止',
                   heartbeat_at=NOW(),finished_at=NOW(),updated_at=NOW()
               WHERE job_id=$1 AND user_id=$2 AND status IN ('pending','processing')""",
            job_id, user_id, message[:1000],
        )

    async def create_job_items(self, job: dict, items: list[dict]) -> list[dict]:
        created: list[dict] = []
        for item in items:
            row = await self.db.fetch_one(
                """INSERT INTO rag_index_job_items
                   (id,job_id,user_id,source_id,file_id,item_type,display_name,status,current_stage,
                    progress_percent,index_id,metadata)
                   VALUES ($1,$2,$3,$4,$5,'source',$6,$7,$8,$9,$10,$11::jsonb)
                   ON CONFLICT (job_id,source_id) DO UPDATE SET
                     file_id=EXCLUDED.file_id,display_name=EXCLUDED.display_name,index_id=EXCLUDED.index_id
                   RETURNING *""",
                str(uuid.uuid4()), job["id"], job["user_id"], item.get("source_id"), item.get("file_id"),
                item.get("file_name", item.get("display_name", "未命名来源")),
                "reused" if item.get("reused") else "pending",
                "completed" if item.get("reused") else "validating",
                100 if item.get("reused") else 0, item.get("id"),
                json.dumps({"reused": bool(item.get("reused"))}),
            )
            if row:
                created.append(_serialize_row(row) or {})
        await self.refresh_job_progress(job["id"], job["user_id"])
        return created

    async def list_job_items(self, job_id: str, user_id: str) -> list[dict]:
        return _serialize_rows(await self.db.fetch_all(
            """SELECT * FROM rag_index_job_items WHERE job_id=$1 AND user_id=$2 ORDER BY created_at""",
            job_id, user_id,
        ))

    async def update_job_item(
        self, job_id: str, user_id: str, file_id: str, status: str, stage: str,
        progress: float, message: str = "", error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        await self.db.execute(
            """UPDATE rag_index_job_items SET status=$4::varchar,current_stage=$5,
                      stage_progress=$6,progress_percent=$6,progress_message=$7,
                      error_code=$8,error_message=$9,heartbeat_at=NOW(),updated_at=NOW(),
                      started_at=COALESCE(started_at,NOW()),
                      finished_at=CASE WHEN $10 THEN NOW() ELSE finished_at END
               WHERE job_id=$1 AND user_id=$2 AND file_id=$3""",
            job_id, user_id, file_id, status, stage, max(0, min(100, progress)), message,
            error_code, error_message[:1000] if error_message else None,
            status in {"completed", "reused", "failed", "cancelled"},
        )
        await self.refresh_job_progress(job_id, user_id)

    async def refresh_job_progress(self, job_id: str, user_id: str) -> None:
        await self.db.execute(
            """UPDATE rag_index_jobs j SET
                   total_item_count=s.total_count,
                   completed_file_count=s.completed_count,
                   failed_file_count=s.failed_count,
                   skipped_item_count=s.reused_count,
                   progress_percent=s.progress,
                   current_stage=s.current_stage,
                   current_item_id=s.current_item_id,
                   progress_message=s.progress_message,
                   heartbeat_at=NOW(),updated_at=NOW()
               FROM (
                   SELECT COUNT(*)::int total_count,
                          COUNT(*) FILTER (WHERE status IN ('completed','reused'))::int completed_count,
                          COUNT(*) FILTER (WHERE status='failed')::int failed_count,
                          COUNT(*) FILTER (WHERE status='reused')::int reused_count,
                          COALESCE(AVG(progress_percent),0)::numeric(5,2) progress,
                          (ARRAY_AGG(current_stage ORDER BY updated_at DESC)
                             FILTER (WHERE status IN ('pending','processing')))[1] current_stage,
                          (ARRAY_AGG(id ORDER BY updated_at DESC)
                             FILTER (WHERE status IN ('pending','processing')))[1] current_item_id,
                          (ARRAY_AGG(progress_message ORDER BY updated_at DESC)
                             FILTER (WHERE status IN ('pending','processing')))[1] progress_message
                   FROM rag_index_job_items WHERE job_id=$1 AND user_id=$2
               ) s
               WHERE j.id=$1 AND j.user_id=$2""",
            job_id, user_id,
        )

    async def fail_job_from_items(self, job_id: str, user_id: str, message: str) -> None:
        await self.fail_unfinished_job_items(job_id, user_id, message)
        await self.refresh_job_progress(job_id, user_id)
        await self.db.execute(
            """UPDATE rag_index_jobs
               SET status='failed',progress_percent=100,error_message=$3,
                   progress_message='索引任务异常终止',heartbeat_at=NOW(),finished_at=NOW(),updated_at=NOW()
               WHERE id=$1 AND user_id=$2""",
            job_id, user_id, message[:1000],
        )

    async def get_job(self, job_id: str, knowledge_base_id: str, user_id: str) -> dict | None:
        row = await self.db.fetch_one(
            """SELECT * FROM rag_index_jobs
               WHERE id=$1 AND knowledge_base_id=$2 AND user_id=$3""",
            job_id, knowledge_base_id, user_id,
        )
        result = _serialize_row(row)
        if result and isinstance(result.get("requested_file_ids"), str):
            result["requested_file_ids"] = json.loads(result["requested_file_ids"])
        return result

    async def get_active_job(self, knowledge_base_id: str, user_id: str) -> dict | None:
        row = await self.db.fetch_one(
            """SELECT * FROM rag_index_jobs
               WHERE knowledge_base_id=$1 AND user_id=$2 AND status IN ('pending','processing')
               ORDER BY created_at DESC LIMIT 1""",
            knowledge_base_id, user_id,
        )
        result = _serialize_row(row)
        if result and isinstance(result.get("requested_file_ids"), str):
            result["requested_file_ids"] = json.loads(result["requested_file_ids"])
        return result

    async def update_job(self, job_id: str, user_id: str, status: str, completed: int, failed: int, error: str | None = None) -> None:
        await self.db.execute(
            """UPDATE rag_index_jobs SET status=$3::varchar,completed_file_count=$4,failed_file_count=$5,
                      progress_percent=CASE WHEN $7 THEN 100 ELSE progress_percent END,
                      error_message=$6,heartbeat_at=NOW(),updated_at=NOW(),
                      started_at=COALESCE(started_at,NOW()),
                      finished_at=CASE WHEN $7 THEN NOW() ELSE finished_at END
               WHERE id=$1 AND user_id=$2""",
            job_id, user_id, status, completed, failed, error[:1000] if error else None,
            status in {"completed", "partial_failed", "failed", "cancelled"},
        )

    async def claim_index(self, index_id: str, user_id: str) -> bool:
        result = await self.db.execute(
            """UPDATE rag_indexes SET status='processing',attempt_count=attempt_count+1,
                      started_at=COALESCE(started_at,NOW()),heartbeat_at=NOW(),updated_at=NOW()
               WHERE id=$1 AND user_id=$2 AND status='pending'""",
            index_id, user_id,
        )
        return "UPDATE 1" in result

    async def heartbeat(self, index_id: str, user_id: str) -> None:
        await self.db.execute(
            "UPDATE rag_indexes SET heartbeat_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2",
            index_id, user_id,
        )

    async def complete_index(self, index_id: str, user_id: str, file_id: str, chunk_count: int) -> None:
        async with self.db.pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    """UPDATE rag_indexes SET status='stale',updated_at=NOW()
                       WHERE user_id=$1 AND file_id=$2 AND id<>$3 AND status='completed'""",
                    user_id, file_id, index_id,
                )
                await conn.execute(
                    """UPDATE rag_indexes SET status='completed',chunk_count=$3,error_code=NULL,error_message=NULL,
                              heartbeat_at=NOW(),completed_at=NOW(),updated_at=NOW()
                       WHERE id=$1 AND user_id=$2""",
                    index_id, user_id, chunk_count,
                )

    async def fail_index(self, index_id: str, user_id: str, code: str, message: str) -> None:
        await self.db.execute(
            """UPDATE rag_indexes SET status='failed',error_code=$3,error_message=$4,
                      heartbeat_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2""",
            index_id, user_id, code, message[:1000],
        )

    async def replace_chunks(self, index_id: str, file_id: str, user_id: str, chunks: list[dict]) -> None:
        async with self.db.pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("DELETE FROM rag_chunks WHERE index_id=$1 AND user_id=$2", index_id, user_id)
                for chunk in chunks:
                    await conn.execute(
                        """INSERT INTO rag_chunks
                           (id,index_id,file_id,user_id,chunk_index,chunk_type,section_path,page_start,page_end,
                            content,content_hash,token_count,extraction_method,metadata,embedding)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)""",
                        chunk["id"], index_id, file_id, user_id, chunk["chunk_index"], chunk["chunk_type"],
                        chunk.get("section_path"), chunk.get("page_start"), chunk.get("page_end"), chunk["content"],
                        chunk["content_hash"], chunk.get("token_count", 0), chunk.get("extraction_method"),
                        json.dumps(chunk.get("metadata", {}), ensure_ascii=False), chunk["embedding"],
                    )

    async def reset_stale_processing(self, stale_seconds: int) -> int:
        threshold = datetime.now(timezone.utc) - timedelta(seconds=stale_seconds)
        result = await self.db.execute(
            """UPDATE rag_indexes SET status='pending',error_code='TASK_INTERRUPTED',
                      error_message='服务重启后自动恢复',updated_at=NOW()
               WHERE status='processing' AND COALESCE(heartbeat_at,started_at,created_at) < $1""",
            threshold,
        )
        return int(result.split()[-1]) if result.split()[-1].isdigit() else 0

    async def list_pending_indexes(self) -> list[dict]:
        return _serialize_rows(await self.db.fetch_all(
            "SELECT * FROM rag_indexes WHERE status='pending' ORDER BY created_at ASC"
        ))

    async def abandon_orphaned_jobs(self) -> int:
        result = await self.db.execute(
            """UPDATE rag_index_jobs j
               SET status='failed',error_message='服务中断前未保存可恢复的任务明细，请重新开始索引',
                   progress_message='索引任务已中断',finished_at=NOW(),heartbeat_at=NOW(),updated_at=NOW()
               WHERE j.status IN ('pending','processing')
                 AND NOT EXISTS (SELECT 1 FROM rag_index_job_items i WHERE i.job_id=j.id)"""
        )
        return int(result.split()[-1]) if result.split()[-1].isdigit() else 0

    async def list_recoverable_jobs(self) -> list[dict]:
        rows = await self.db.fetch_all(
            """SELECT j.* FROM rag_index_jobs j
               WHERE j.status IN ('pending','processing')
                 AND EXISTS (
                     SELECT 1 FROM rag_index_job_items i
                     WHERE i.job_id=j.id AND i.status IN ('pending','processing')
                 )
               ORDER BY j.created_at ASC"""
        )
        return _serialize_rows(rows)

    async def build_recovery_items(self, job_id: str, user_id: str) -> list[dict]:
        rows = await self.db.fetch_all(
            """SELECT ri.*,i.display_name AS file_name,FALSE AS reused
               FROM rag_index_job_items i
               JOIN rag_indexes ri ON ri.id=i.index_id AND ri.user_id=i.user_id
               WHERE i.job_id=$1 AND i.user_id=$2 AND i.status IN ('pending','processing')
               ORDER BY i.created_at""",
            job_id, user_id,
        )
        return _serialize_rows(rows)

    async def prepare_job_for_recovery(self, job_id: str, user_id: str) -> None:
        await self.db.execute(
            """UPDATE rag_indexes ri
               SET status='pending',error_code='TASK_INTERRUPTED',error_message='服务重启后恢复索引',
                   heartbeat_at=NOW(),updated_at=NOW()
               FROM rag_index_job_items i
               WHERE i.job_id=$1 AND i.user_id=$2 AND i.index_id=ri.id
                 AND i.status='processing' AND ri.status='processing'""",
            job_id, user_id,
        )
        await self.db.execute(
            """UPDATE rag_index_job_items
               SET status='pending',current_stage='validating',progress_message='服务重启后恢复索引',
                   error_code=NULL,error_message=NULL,heartbeat_at=NOW(),updated_at=NOW()
               WHERE job_id=$1 AND user_id=$2 AND status='processing'""",
            job_id, user_id,
        )
        await self.db.execute(
            """UPDATE rag_index_jobs
               SET status='pending',current_stage='validating',progress_message='服务重启后恢复索引',
                   error_message=NULL,heartbeat_at=NOW(),updated_at=NOW(),finished_at=NULL
               WHERE id=$1 AND user_id=$2""",
            job_id, user_id,
        )

    async def log_query(self, record: dict) -> None:
        await self.db.execute(
            """INSERT INTO rag_query_logs
               (id,knowledge_base_id,user_id,query,selected_file_ids,retrieved_chunk_ids,cited_file_ids,
                chat_provider,chat_model,latency_ms,token_usage,refused)
               VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,$11::jsonb,$12)""",
            str(uuid.uuid4()), record["knowledge_base_id"], record["user_id"], record["query"][:4000],
            json.dumps(record.get("selected_file_ids", [])), json.dumps(record.get("retrieved_chunk_ids", [])),
            json.dumps(record.get("cited_file_ids", [])), record.get("chat_provider"), record.get("chat_model"),
            record.get("latency_ms"), json.dumps(record.get("token_usage", {})), record.get("refused", False),
        )


async def get_rag_repository() -> RagRepository:
    return RagRepository(await get_database())

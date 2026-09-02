"""手动异步索引编排。"""
from __future__ import annotations

import asyncio
import uuid

from app.config import get_settings
from app.infrastructure.knowledge_repository import KnowledgeRepository
from app.infrastructure.rag_repository import RagRepository
from app.services.embedding_service import EmbeddingProvider
from app.services.extract_service import extract_text_with_ocr
from app.services.file_service import FileService
from app.services.rag_chunker import RagChunker
from app.utils.exceptions import AppError, NotFoundError


class RagIndexService:
    def __init__(
        self,
        knowledge_repository: KnowledgeRepository,
        rag_repository: RagRepository,
        embedding: EmbeddingProvider,
        file_service: FileService | None = None,
        chunker: RagChunker | None = None,
    ):
        self.knowledge_repository = knowledge_repository
        self.rag_repository = rag_repository
        self.embedding = embedding
        self.file_service = file_service or FileService()
        settings = get_settings()
        self.settings = settings
        self.chunker = chunker or RagChunker(
            settings.rag_chunk_size, settings.rag_chunk_overlap, settings.rag_min_chunk_chars,
        )

    def index_config(self) -> dict:
        return {
            "provider": self.settings.rag_embedding_provider,
            "model": self.settings.rag_embedding_model,
            "dimension": self.settings.rag_embedding_dimension,
            "chunking_version": self.settings.rag_chunking_version,
            "index_version": self.settings.rag_index_version,
        }

    async def create_job(self, knowledge_base_id: str, user_id: str, file_ids: list[str], force: bool = False) -> tuple[dict, list[dict]]:
        if not await self.knowledge_repository.get(knowledge_base_id, user_id):
            raise NotFoundError("知识库不存在")
        member_files = await self.knowledge_repository.validate_member_files(knowledge_base_id, user_id, file_ids)
        if len(member_files) != len(set(file_ids)):
            raise AppError("部分文件不属于当前知识库", 400, "INVALID_KNOWLEDGE_FILES")
        prepared_files: list[tuple[dict, dict | None, str]] = []
        for item in member_files:
            if item.get("type", "").lower() in {"xls", "xlsx", "csv", "doc"}:
                raise AppError(f"文件 {item['original_name']} 暂不支持知识库索引", 400, "UNSUPPORTED_RAG_FILE")
            source_hash = item.get("file_hash")
            if not source_hash:
                raise AppError("文件缺少内容哈希，无法建立安全索引", 409, "FILE_HASH_MISSING")
            source = await self._ensure_file_source(item["id"], user_id)
            prepared_files.append((item, source, source_hash))

        job: dict | None = None
        try:
            job = await self.rag_repository.create_job(knowledge_base_id, user_id, file_ids)
            index_items: list[dict] = []
            for item, source, source_hash in prepared_files:
                reusable = await self.rag_repository.find_reusable_index(
                    user_id, item["id"], source_hash, self.index_config(),
                )
                if reusable and not force:
                    index_items.append({**reusable, "source_id": source.get("id") if source else None, "reused": True, "file_name": item["original_name"]})
                    continue
                index = await self.rag_repository.create_index(
                    user_id, item["id"], source_hash, self.index_config(), force,
                )
                index_items.append({**index, "source_id": source.get("id") if source else None, "reused": False, "file_name": item["original_name"]})
            await self.rag_repository.create_job_items(job, index_items)
            return job, index_items
        except Exception:
            if job:
                await self.rag_repository.delete_job(job["id"], user_id)
            raise

    async def _ensure_file_source(self, file_id: str, user_id: str) -> dict | None:
        from app.infrastructure.knowledge_source_repository import KnowledgeSourceRepository

        return await KnowledgeSourceRepository(self.rag_repository.db).ensure_file_source(file_id, user_id)

    async def process_job(self, job: dict, index_items: list[dict]) -> None:
        completed = 0
        failed = 0
        await self.rag_repository.update_job(job["id"], job["user_id"], "processing", 0, 0)
        for item in index_items:
            if item.get("reused"):
                completed += 1
                await self.rag_repository.update_job_item(
                    job["id"], job["user_id"], item["file_id"], "reused", "completed", 100, "已复用现有索引",
                )
                continue
            try:
                succeeded = await self.process_index(item, job["user_id"], job["id"])
                if succeeded:
                    completed += 1
                else:
                    failed += 1
            except Exception as exc:
                failed += 1
                await self.rag_repository.fail_index(item["id"], job["user_id"], "INDEX_FAILED", str(exc))
                await self.rag_repository.update_job_item(
                    job["id"], job["user_id"], item["file_id"], "failed", "failed", 100,
                    "索引失败", "INDEX_FAILED", str(exc),
                )
            await self.rag_repository.update_job(job["id"], job["user_id"], "processing", completed, failed)
        status = "completed" if failed == 0 else ("partial_failed" if completed else "failed")
        await self.rag_repository.update_job(job["id"], job["user_id"], status, completed, failed)

    async def process_index(self, index: dict, user_id: str, job_id: str | None = None) -> bool:
        async def progress(status: str, stage: str, percent: float, message: str) -> None:
            if job_id:
                await self.rag_repository.update_job_item(
                    job_id, user_id, index["file_id"], status, stage, percent, message,
                )

        await progress("processing", "validating", 5, "正在校验索引状态")
        if not await self.rag_repository.claim_index(index["id"], user_id):
            wait_seconds = max(1, self.settings.rag_task_stale_seconds)
            for _ in range(wait_seconds):
                current = await self.rag_repository.get_index(index["id"], user_id)
                if not current:
                    await progress("failed", "failed", 100, "并发索引记录不存在")
                    return False
                if current.get("status") == "completed":
                    await progress("reused", "completed", 100, "已复用并发任务生成的索引")
                    return True
                if current.get("status") in {"failed", "stale"}:
                    await progress("failed", "failed", 100, current.get("error_message") or "并发索引任务未成功完成")
                    return False
                await asyncio.sleep(1)
            await progress("failed", "failed", 100, "等待同一文件的并发索引任务超时")
            return False
        await progress("processing", "loading", 12, "正在读取文件")
        content = await self.file_service.download(index["file_id"], user_id)
        await progress("processing", "extracting", 25, "正在解析文档内容")
        text, used_ocr, ocr_error = await extract_text_with_ocr(content, user_id=user_id)
        if not text.strip():
            raise ValueError(ocr_error or "文件未提取到可索引文本")
        await self.rag_repository.heartbeat(index["id"], user_id)
        await progress("processing", "chunking", 45, "正在分块")
        drafts = self.chunker.chunk(text, "ocr" if used_ocr else "text")
        if not drafts:
            raise ValueError("文件未生成有效片段")
        await progress("processing", "embedding", 60, f"正在生成 {len(drafts)} 个片段的向量")
        vectors = await self.embedding.embed_texts([draft.content for draft in drafts], user_id)
        chunks = []
        for draft, vector in zip(drafts, vectors, strict=True):
            chunks.append({
                "id": str(uuid.uuid4()),
                "chunk_index": draft.chunk_index,
                "chunk_type": draft.chunk_type,
                "section_path": draft.section_path,
                "page_start": draft.page_start,
                "page_end": draft.page_end,
                "content": draft.content,
                "content_hash": draft.content_hash,
                "token_count": max(1, len(draft.content) // 2),
                "extraction_method": draft.extraction_method,
                "metadata": {**draft.metadata, "ocr_error": ocr_error},
                "embedding": vector,
            })
        await progress("processing", "persisting", 90, "正在写入向量索引")
        await self.rag_repository.replace_chunks(index["id"], index["file_id"], user_id, chunks)
        await self.rag_repository.complete_index(index["id"], user_id, index["file_id"], len(chunks))
        await progress("completed", "completed", 100, f"索引完成，共 {len(chunks)} 个片段")
        return True


class RagTaskRunner:
    def __init__(self, service: RagIndexService):
        self.service = service
        self.tasks: set[asyncio.Task] = set()
        self.semaphore = asyncio.Semaphore(get_settings().rag_index_concurrency)

    def submit(self, job: dict, items: list[dict]) -> None:
        task = asyncio.create_task(self._run(job, items))
        self.tasks.add(task)
        task.add_done_callback(self._task_done)

    def _task_done(self, task: asyncio.Task) -> None:
        self.tasks.discard(task)
        if task.cancelled():
            return
        error = task.exception()
        if error:
            print(f"RAG 索引后台任务异常: {error}")

    async def _run(self, job: dict, items: list[dict]) -> None:
        async with self.semaphore:
            try:
                await self.service.process_job(job, items)
            except Exception as exc:
                message = str(exc) or exc.__class__.__name__
                try:
                    await self.service.rag_repository.fail_job_from_items(
                        job["id"], job["user_id"], message,
                    )
                except Exception as persist_error:
                    raise RuntimeError(
                        f"索引任务失败且状态持久化失败: {persist_error}；原始错误: {message}"
                    ) from exc

    async def shutdown(self) -> None:
        if self.tasks:
            await asyncio.wait(self.tasks, timeout=5)

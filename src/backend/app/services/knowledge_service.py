"""Knowledge-base ingestion and pgvector semantic retrieval."""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import uuid
from functools import lru_cache

from app.config import get_settings
from app.infrastructure.database import get_database
from app.infrastructure.pg_storage import get_file
from app.services.extract_service import extract_text_from_content
from app.services.file_service import FileService


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    """Split text on paragraph boundaries while retaining bounded overlap."""
    normalized = re.sub(r"\r\n?", "\n", text).strip()
    if not normalized:
        return []
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", normalized) if part.strip()]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        pieces = [paragraph[i : i + size] for i in range(0, len(paragraph), size)] or [paragraph]
        for piece in pieces:
            candidate = f"{current}\n\n{piece}".strip() if current else piece
            if current and len(candidate) > size:
                chunks.append(current)
                prefix = current[-overlap:] if overlap else ""
                current = f"{prefix}\n\n{piece}".strip()
            else:
                current = candidate
    if current:
        chunks.append(current)
    return [chunk for chunk in chunks if chunk.strip()]


class LocalEmbeddingProvider:
    """Lazy, process-wide FastEmbed provider for free local embeddings."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._model = None
        self._lock = asyncio.Lock()

    async def _get_model(self):
        if self._model is not None:
            return self._model
        async with self._lock:
            if self._model is None:
                from fastembed import TextEmbedding

                self._model = await asyncio.to_thread(
                    TextEmbedding,
                    model_name=self.settings.knowledge_embedding_model,
                    cache_dir=self.settings.knowledge_embedding_cache_dir,
                )
        return self._model

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        model = await self._get_model()
        vectors = await asyncio.to_thread(lambda: [item.tolist() for item in model.embed(texts)])
        self._validate(vectors)
        return vectors

    async def embed_query(self, text: str) -> list[float]:
        model = await self._get_model()
        vectors = await asyncio.to_thread(lambda: [item.tolist() for item in model.query_embed(text)])
        self._validate(vectors)
        return vectors[0]

    @staticmethod
    def _validate(vectors: list[list[float]]) -> None:
        if not vectors or any(len(vector) != 512 for vector in vectors):
            raise RuntimeError("嵌入模型输出维度必须为 512，请检查 KNOWLEDGE_EMBEDDING_MODEL")


@lru_cache(maxsize=1)
def get_embedding_provider() -> LocalEmbeddingProvider:
    return LocalEmbeddingProvider()


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in vector) + "]"


class KnowledgeService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.files = FileService()
        self.embeddings = get_embedding_provider()

    async def list_documents(self, user_id: str) -> list[dict]:
        db = await get_database()
        return await db.fetch_all(
            """SELECT id, file_id, name, status, chunk_count, embedding_model,
                      content_hash, error_message, created_at, updated_at
               FROM knowledge_documents WHERE user_id = $1 ORDER BY updated_at DESC""",
            user_id,
        )

    async def ingest(self, file_id: str, user_id: str, force: bool = False) -> dict:
        file_record = await get_file(file_id, user_id=user_id)
        if not file_record:
            raise FileNotFoundError("文件不存在或无权访问")
        content = await self.files.download(file_id, user_id)
        content_hash = hashlib.sha256(content).hexdigest()
        db = await get_database()
        existing = await db.fetch_one(
            "SELECT * FROM knowledge_documents WHERE user_id = $1 AND file_id = $2",
            user_id,
            file_id,
        )
        if existing and existing.get("content_hash") == content_hash and existing.get("status") == "ready" and not force:
            return existing

        document_id = existing["id"] if existing else str(uuid.uuid4())
        await db.execute(
            """INSERT INTO knowledge_documents
                   (id, user_id, file_id, name, status, embedding_model, content_hash, updated_at)
               VALUES ($1, $2, $3, $4, 'processing', $5, $6, NOW())
               ON CONFLICT (user_id, file_id) DO UPDATE SET
                   name = EXCLUDED.name, status = 'processing', embedding_model = EXCLUDED.embedding_model,
                   content_hash = EXCLUDED.content_hash, error_message = NULL, updated_at = NOW()""",
            document_id,
            user_id,
            file_id,
            file_record.get("original_name") or file_id,
            self.settings.knowledge_embedding_model,
            content_hash,
        )
        try:
            text, needs_ocr = await asyncio.to_thread(extract_text_from_content, content)
            if needs_ocr and not text.strip():
                raise ValueError("扫描版 PDF 未提取到文本，请先完成 OCR 后再入库")
            chunks = chunk_text(text, self.settings.knowledge_chunk_size, self.settings.knowledge_chunk_overlap)
            if not chunks:
                raise ValueError("文档中没有可索引的文本")
            vectors: list[list[float]] = []
            batch_size = self.settings.knowledge_embedding_batch_size
            for start in range(0, len(chunks), batch_size):
                vectors.extend(await self.embeddings.embed_documents(chunks[start : start + batch_size]))

            async with db.pool.acquire() as connection:
                async with connection.transaction():
                    await connection.execute("DELETE FROM knowledge_chunks WHERE document_id = $1 AND user_id = $2", document_id, user_id)
                    await connection.executemany(
                        """INSERT INTO knowledge_chunks
                               (document_id, user_id, chunk_index, content, metadata, embedding)
                           VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector)""",
                        [
                            (document_id, user_id, index, chunk, json.dumps({"file_id": file_id, "name": file_record.get("original_name")}), _vector_literal(vector))
                            for index, (chunk, vector) in enumerate(zip(chunks, vectors))
                        ],
                    )
                    await connection.execute(
                        """UPDATE knowledge_documents SET status = 'ready', chunk_count = $1,
                                  error_message = NULL, updated_at = NOW()
                           WHERE id = $2 AND user_id = $3""",
                        len(chunks), document_id, user_id,
                    )
            return await db.fetch_one("SELECT * FROM knowledge_documents WHERE id = $1 AND user_id = $2", document_id, user_id)
        except Exception as exc:
            await db.execute(
                "UPDATE knowledge_documents SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
                str(exc)[:1000], document_id, user_id,
            )
            raise

    async def delete(self, document_id: str, user_id: str) -> bool:
        db = await get_database()
        result = await db.execute("DELETE FROM knowledge_documents WHERE id = $1 AND user_id = $2", document_id, user_id)
        return "DELETE 1" in result

    async def search(self, query: str, user_id: str, top_k: int, min_score: float) -> list[dict]:
        vector = await self.embeddings.embed_query(query)
        db = await get_database()
        return await db.fetch_all(
            """SELECT kc.id, kc.document_id, kd.file_id, kd.name, kc.chunk_index, kc.content,
                      GREATEST(0, 1 - (kc.embedding <=> $2::vector))::float AS score
               FROM knowledge_chunks kc
               JOIN knowledge_documents kd ON kd.id = kc.document_id AND kd.user_id = kc.user_id
               WHERE kc.user_id = $1 AND kd.status = 'ready'
                 AND 1 - (kc.embedding <=> $2::vector) >= $3
               ORDER BY kc.embedding <=> $2::vector
               LIMIT $4""",
            user_id, _vector_literal(vector), min_score, top_k,
        )

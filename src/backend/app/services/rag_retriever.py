"""RAG 混合检索与多文件上下文选择。"""
from __future__ import annotations

from collections import defaultdict

from app.config import get_settings
from app.infrastructure.vector_store import VectorStoreProtocol, reciprocal_rank_fusion
from app.services.embedding_service import EmbeddingProvider


class RagRetriever:
    def __init__(self, embedding: EmbeddingProvider, vector_store: VectorStoreProtocol):
        self.embedding = embedding
        self.vector_store = vector_store
        self.settings = get_settings()

    async def retrieve(self, question: str, user_id: str, file_ids: list[str]) -> list[dict]:
        query_vector = (await self.embedding.embed_texts([question], user_id))[0]
        vector_rows = await self.vector_store.vector_search(
            user_id, file_ids, query_vector, self.settings.rag_vector_top_k,
        )
        keyword_rows = await self.vector_store.keyword_search(
            user_id, file_ids, question, self.settings.rag_keyword_top_k,
        )
        fused = reciprocal_rank_fusion(vector_rows, keyword_rows, self.settings.rag_rrf_k)
        return self._select_context(fused)

    def _select_context(self, rows: list[dict]) -> list[dict]:
        selected: list[dict] = []
        file_counts: defaultdict[str, int] = defaultdict(int)
        seen_hashes: set[str] = set()
        context_k = self.settings.rag_context_k
        per_file_limit = max(2, (context_k + 1) // 2)
        for row in rows:
            content_hash = row.get("content_hash")
            if content_hash and content_hash in seen_hashes:
                continue
            if file_counts[row["file_id"]] >= per_file_limit:
                continue
            selected.append(row)
            file_counts[row["file_id"]] += 1
            if content_hash:
                seen_hashes.add(content_hash)
            if len(selected) >= context_k:
                break
        return selected

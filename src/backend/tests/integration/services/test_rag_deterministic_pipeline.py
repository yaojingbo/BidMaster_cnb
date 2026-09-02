"""不依赖外部服务的 RAG 最小端到端链路测试。"""

import pytest

from app.infrastructure.vector_store import reciprocal_rank_fusion
from app.services.rag_answer_service import RagAnswerService
from app.services.rag_chunker import RagChunker
from app.services.rag_index_service import RagIndexService
from app.services.rag_retriever import RagRetriever
from src.backend.tests.fakes.rag_fakes import DeterministicFakeEmbedding, FakeAnswerGenerator, InMemoryVectorStore


USER_ID = "smoke-user"
FILE_ID = "smoke-file"


class MemoryRagRepository:
    """只实现索引服务所需的持久化边界，并把向量写入内存。"""

    def __init__(self):
        self.rows: list[dict] = []
        self.completed_chunks = 0
        self.progress: list[tuple[str, str]] = []

    async def claim_index(self, index_id: str, user_id: str) -> bool:
        return True

    async def heartbeat(self, index_id: str, user_id: str) -> None:
        return None

    async def replace_chunks(self, index_id: str, file_id: str, user_id: str, chunks: list[dict]) -> None:
        self.rows = [
            {
                **chunk,
                "index_id": index_id,
                "file_id": file_id,
                "user_id": user_id,
                "file_name": "招标文件.pdf",
            }
            for chunk in chunks
        ]

    async def complete_index(self, index_id: str, user_id: str, file_id: str, chunk_count: int) -> None:
        self.completed_chunks = chunk_count

    async def update_job_item(self, job_id, user_id, file_id, status, stage, percent, message, *args):
        self.progress.append((status, stage))


class MemoryFileService:
    async def download(self, file_id: str, user_id: str) -> bytes:
        return b"unused: extraction is replaced by the deterministic test fixture"


@pytest.mark.asyncio
async def test_rag_pipeline_is_deterministic_without_database_or_credentials(monkeypatch):
    """验证切片、假 embedding、向量写入、混合检索、RRF 和回答引用可串联。"""
    source_text = """--- 第 3 页文本 ---
第三章 投标保证金
投标保证金金额为人民币十万元，投标人须在投标截止时间前提交投标保证金。

--- 第 4 页文本 ---
第四章 评标办法
综合评分法总分为一百分，技术与商务部分分别计分。
"""

    async def deterministic_extract(_content, user_id=None):
        return source_text, False, None

    # 只替换文档提取边界；不会触发 PDF、数据库、LLM 或 API key。
    monkeypatch.setattr("app.services.rag_index_service.extract_text_with_ocr", deterministic_extract)

    repository = MemoryRagRepository()
    service = RagIndexService(
        knowledge_repository=object(),
        rag_repository=repository,
        embedding=DeterministicFakeEmbedding(),
        file_service=MemoryFileService(),
        chunker=RagChunker(chunk_size=120, overlap=20, min_chars=10),
    )

    indexed = await service.process_index(
        {"id": "index-1", "file_id": FILE_ID}, USER_ID, job_id="job-1"
    )

    assert indexed is True
    assert repository.completed_chunks == len(repository.rows) > 0
    assert {row["user_id"] for row in repository.rows} == {USER_ID}
    assert all(row["embedding"] for row in repository.rows)
    assert any("投标保证金" in row["content"] for row in repository.rows)
    assert ("completed", "completed") in repository.progress

    # 用索引服务写入的行构造真实 vector-store 协议的内存替身。
    store = InMemoryVectorStore(repository.rows)
    retriever = RagRetriever(DeterministicFakeEmbedding(), store)
    selected = await retriever.retrieve("投标保证金", USER_ID, [FILE_ID])

    assert selected
    assert "投标保证金" in selected[0]["content"]
    vector_rows = await store.vector_search(
        USER_ID, [FILE_ID], (await DeterministicFakeEmbedding().embed_texts(["投标保证金"]))[0], 10,
    )
    keyword_rows = await store.keyword_search(USER_ID, [FILE_ID], "投标保证金", 10)
    fused = reciprocal_rank_fusion(vector_rows, keyword_rows)
    assert fused
    assert fused[0]["id"] == selected[0]["id"]

    answer = await RagAnswerService(FakeAnswerGenerator("投标保证金为人民币十万元。[1]")).answer(
        "kb-smoke", "投标保证金金额是多少？", selected, [], "test", None, USER_ID,
    )
    assert answer.refused is False
    assert answer.citations[0].chunk_id == selected[0]["id"]

    # 同一输入必须产生同一向量和同一检索首项，避免 smoke 测试自身不稳定。
    second = await retriever.retrieve("投标保证金", USER_ID, [FILE_ID])
    assert [row["id"] for row in second] == [row["id"] for row in selected]
    assert await DeterministicFakeEmbedding().embed_texts(["投标保证金金额"]) == await DeterministicFakeEmbedding().embed_texts(["投标保证金金额"])

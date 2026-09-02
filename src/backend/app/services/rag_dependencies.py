"""RAG 运行时依赖工厂。"""
from __future__ import annotations

from app.infrastructure.db_schema import get_rag_database_capability
from app.infrastructure.knowledge_repository import KnowledgeRepository
from app.infrastructure.knowledge_source_repository import KnowledgeSourceRepository
from app.infrastructure.rag_repository import RagRepository
from app.infrastructure.vector_store import PostgresVectorStore
from app.services.embedding_service import EmbeddingService
from app.services.knowledge_base_service import KnowledgeBaseService
from app.services.knowledge_source_service import KnowledgeSourceService
from app.services.rag_answer_service import LiteLLMAnswerGenerator, RagAnswerService
from app.services.rag_index_service import RagIndexService, RagTaskRunner
from app.services.rag_retriever import RagRetriever
from app.infrastructure.database import get_database
from app.utils.exceptions import AppError


_task_runner: RagTaskRunner | None = None


def ensure_rag_available() -> None:
    capability = get_rag_database_capability()
    if not capability.ready:
        raise AppError(
            f"知识库数据库能力不可用：{capability.reason or '未知原因'}",
            503,
            "RAG_DATABASE_UNAVAILABLE",
        )


async def build_rag_services() -> dict:
    db = await get_database()
    knowledge_repository = KnowledgeRepository(db)
    source_repository = KnowledgeSourceRepository(db)
    rag_repository = RagRepository(db)
    embedding = EmbeddingService()
    vector_store = PostgresVectorStore(db)
    index_service = RagIndexService(knowledge_repository, rag_repository, embedding)
    return {
        "knowledge": KnowledgeBaseService(knowledge_repository),
        "sources": KnowledgeSourceService(source_repository, knowledge_repository),
        "source_repository": source_repository,
        "knowledge_repository": knowledge_repository,
        "rag_repository": rag_repository,
        "embedding": embedding,
        "vector_store": vector_store,
        "index": index_service,
        "retriever": RagRetriever(embedding, vector_store),
        "answer": RagAnswerService(LiteLLMAnswerGenerator()),
    }


async def get_task_runner() -> RagTaskRunner:
    global _task_runner
    if _task_runner is None:
        services = await build_rag_services()
        _task_runner = RagTaskRunner(services["index"])
    return _task_runner


async def recover_index_jobs() -> dict[str, int]:
    runner = await get_task_runner()
    services = await build_rag_services()
    repository = services["rag_repository"]
    abandoned = await repository.abandon_orphaned_jobs()
    recovered = 0
    for job in await repository.list_recoverable_jobs():
        await repository.prepare_job_for_recovery(job["id"], job["user_id"])
        items = await repository.build_recovery_items(job["id"], job["user_id"])
        if items:
            runner.submit(job, items)
            recovered += 1
    return {"abandoned": abandoned, "recovered": recovered}


async def shutdown_task_runner() -> None:
    global _task_runner
    if _task_runner is not None:
        await _task_runner.shutdown()
        _task_runner = None

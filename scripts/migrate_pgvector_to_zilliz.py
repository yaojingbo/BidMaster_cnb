"""把现有 pgvector 向量迁移到 Zilliz Cloud（一次性，幂等）。

只迁移与当前后端活跃索引配置（provider/model/dim/chunking_version/index_version）
一致的已完成索引，与 validate_member_files / vector_search 的过滤口径完全对齐，
避免把其它 index_version（如 rag-service 的 v3_text_embedding_v4）的旧向量混入
当前集合。片段正文等元数据仍留在 Postgres，检索时按 chunk_id 回查。

用法：
    PYTHONPATH=src/backend .venv/bin/python scripts/migrate_pgvector_to_zilliz.py

依赖 DATABASE_URL 与 ZILLIZ_* / RAG_VECTOR_COLLECTION / RAG_INDEX_VERSION 配置，
生产环境通过环境变量覆盖 DATABASE_URL 指向生产库即可复用本脚本。
"""
from __future__ import annotations

import asyncio
from collections import defaultdict

from app.config import get_settings
from app.infrastructure.database import get_database, close_database
from app.infrastructure.zilliz_vector_store import ZillizVectorStore


def _to_list(value) -> list[float]:
    if value is None:
        return []
    # asyncpg 注册 pgvector 编解码后，vector 列返回 pgvector.vector.Vector（非 numpy 子类，无 .tolist()），
    # 唯一转换入口是 .to_numpy()。
    if hasattr(value, "to_numpy"):
        return value.to_numpy().tolist()
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, (list, tuple)):
        return list(value)
    return value


async def migrate() -> None:
    db = await get_database()
    store = ZillizVectorStore(db)
    settings = get_settings()

    rows = await db.fetch_all(
        """SELECT rc.id, rc.file_id, rc.user_id, rc.index_id, rc.embedding
           FROM rag_chunks rc
           JOIN rag_indexes ri ON ri.id = rc.index_id AND ri.user_id = rc.user_id
           WHERE ri.status = 'completed'
             AND ri.embedding_provider = $1
             AND ri.embedding_model = $2
             AND ri.embedding_dimension = $3
             AND ri.chunking_version = $4
             AND ri.index_version = $5
           ORDER BY rc.user_id, rc.file_id""",
        settings.rag_embedding_provider,
        settings.rag_embedding_model,
        settings.rag_embedding_dimension,
        settings.rag_chunking_version,
        settings.rag_index_version,
    )
    if not rows:
        print("没有可迁移的已完成索引（与当前 index_version 匹配的 completed 索引为空）")
        return

    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for row in rows:
        key = (row["user_id"], row["file_id"], row["index_id"])
        groups[key].append({"id": row["id"], "embedding": _to_list(row["embedding"])})

    total_chunks = 0
    for (user_id, file_id, index_id), chunks in groups.items():
        await store.upsert_chunks(user_id, file_id, index_id, chunks)
        total_chunks += len(chunks)
        print(f"已迁移 file_id={file_id}（user={user_id}）{len(chunks)} 个片段")

    print(f"迁移完成：{len(groups)} 个文件，共 {total_chunks} 个向量片段写入 collection={store.collection}")


async def _run() -> None:
    try:
        await migrate()
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(_run())

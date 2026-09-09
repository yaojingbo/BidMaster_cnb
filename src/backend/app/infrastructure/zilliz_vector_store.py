"""Zilliz Cloud（Milvus 兼容）向量存储实现。

复用 src/rag-service 已验证的 Zilliz REST 适配设计：
- 传输层固定 REST（serverless Zilliz 仅暴露 REST，gRPC 19530 不可用），路径前缀 {uri}/v2/vectordb
- 认证头 ``Authorization: Bearer <token>``
- 集合按 index_version 分版本命名，COSINE 度量 + AUTOINDEX

Zilliz 只存向量与最小标量（chunk_id / user_id / file_id / index_id）；片段正文、页码、
引用等元数据仍存 Postgres ``rag_chunks``，检索后按 chunk_id 回查拼接。因此
RagRetriever / RagAnswerService 完全不用改，关键词检索也继续走 Postgres。
"""
from __future__ import annotations

import httpx

from app.config import get_settings
from app.infrastructure.pg_storage import _serialize_rows
from app.infrastructure.vector_store import PostgresVectorStore

_PK_FIELD = "chunk_id"
_VECTOR_FIELD = "vector"
_SCALAR_FIELDS = ("chunk_id", "user_id", "file_id", "index_id")
_UPSERT_BATCH_SIZE = 500


class ZillizError(RuntimeError):
    """Zilliz REST 调用失败。"""


def sanitize_collection_name(base: str, version: str) -> str:
    """集合名须符合 [A-Za-z_][A-Za-z0-9_]*；把 version 中的 - 等非法字符替换为 _。"""
    raw = f"{base}_{version}"
    return "".join(ch if ch.isalnum() or ch == "_" else "_" for ch in raw)


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _quote(value: str) -> str:
    return f'"{_escape(value)}"'


def build_filter(user_id: str, file_ids: list[str]) -> str:
    """构造 Milvus 布尔表达式：user_id == "x" && file_id in ["a","b"]。

    file_ids 为空时只按 user_id 过滤，避免生成 file_id in []（Milvus 对空 in 的行为依版本而异）。
    """
    if not file_ids:
        return f"user_id == {_quote(user_id)}"
    quoted = ", ".join(_quote(v) for v in file_ids)
    return f"user_id == {_quote(user_id)} && file_id in [{quoted}]"


class ZillizClient:
    """Zilliz Cloud REST（Milvus RESTful v2）最小客户端，仅封装本项目所需能力。"""

    def __init__(self, uri: str, token: str, db_name: str):
        self.base_url = f"{uri.rstrip('/')}/v2/vectordb"
        self.db_name = db_name
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        self._loaded: set[str] = set()

    async def _post(self, path: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            response = await client.post(f"{self.base_url}{path}", headers=self._headers, json=payload)
        if response.status_code != 200:
            raise ZillizError(f"Zilliz REST 失败（HTTP {response.status_code}）：{response.text[:500]}")
        body = response.json()
        if body.get("code") not in (0, None):
            raise ZillizError(f"Zilliz 返回错误（code={body.get('code')}）：{body.get('message', '')[:500]}")
        return body

    async def list_collections(self) -> list[str]:
        body = await self._post("/collections/list", {"dbName": self.db_name})
        return [name for name in body.get("data", []) if isinstance(name, str)]

    async def has_collection(self, name: str) -> bool:
        return name in await self.list_collections()

    async def load_collection(self, name: str) -> None:
        if name in self._loaded:
            return
        await self._post("/collections/load", {"collectionName": name, "dbName": self.db_name})
        self._loaded.add(name)

    async def create_collection(self, name: str, dimension: int) -> None:
        await self._post("/collections/create", {
            "collectionName": name,
            "dbName": self.db_name,
            "schema": {
                "autoID": False,
                "enabledDynamicField": True,
                "fields": [
                    {"fieldName": _PK_FIELD, "dataType": "VarChar", "isPrimary": True,
                     "elementTypeParams": {"max_length": 64}},
                    {"fieldName": _VECTOR_FIELD, "dataType": "FloatVector",
                     "elementTypeParams": {"dim": dimension}},
                    {"fieldName": "user_id", "dataType": "VarChar", "elementTypeParams": {"max_length": 64}},
                    {"fieldName": "file_id", "dataType": "VarChar", "elementTypeParams": {"max_length": 64}},
                    {"fieldName": "index_id", "dataType": "VarChar", "elementTypeParams": {"max_length": 64}},
                ],
            },
            "indexParams": [
                {"fieldName": _VECTOR_FIELD, "indexName": "vector_idx", "metricType": "COSINE",
                 "params": {"index_type": "AUTOINDEX"}},
            ],
        })
        await self.load_collection(name)

    async def ensure_collection(self, name: str, dimension: int) -> None:
        if await self.has_collection(name):
            return
        await self.create_collection(name, dimension)

    async def upsert(self, name: str, rows: list[dict]) -> None:
        if not rows:
            return
        await self._post("/entities/upsert", {"collectionName": name, "dbName": self.db_name, "data": rows})

    async def delete(self, name: str, filter_expr: str) -> None:
        await self._post("/entities/delete", {"collectionName": name, "dbName": self.db_name, "filter": filter_expr})

    async def search(self, name: str, vector: list[float], limit: int, filter_expr: str | None) -> list[tuple[str, float]]:
        payload: dict = {
            "collectionName": name,
            "dbName": self.db_name,
            "data": [vector],
            "annsField": _VECTOR_FIELD,
            "limit": limit,
            "outputFields": list(_SCALAR_FIELDS),
        }
        if filter_expr:
            payload["filter"] = filter_expr
        body = await self._post("/entities/search", payload)
        hits = body.get("data", [[]])
        # Milvus RESTful 检索响应：data 为二维数组，data[i] 对应当次第 i 个查询向量。
        if hits and isinstance(hits[0], list):
            hits = hits[0]
        results: list[tuple[str, float]] = []
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            chunk_id = str(hit.get(_PK_FIELD) or hit.get("id") or "")
            if not chunk_id:
                continue
            # COSINE 度量下 REST 的 distance 字段实际是余弦相似度（实测：同向=1.0，正交=0.0）。
            similarity = hit.get("distance")
            results.append((chunk_id, float(similarity) if isinstance(similarity, (int, float)) else 0.0))
        return results


class ZillizVectorStore(PostgresVectorStore):
    """向量检索走 Zilliz，关键词检索与元数据回查继续走 Postgres（继承 PostgresVectorStore）。"""

    def __init__(self, db):
        super().__init__(db)
        settings = get_settings()
        missing = [name for name, value in (
            ("zilliz_uri", settings.zilliz_uri),
            ("zilliz_token", settings.zilliz_token),
            ("zilliz_db_name", settings.zilliz_db_name),
        ) if not value]
        if missing:
            raise ZillizError("RAG_VECTOR_STORE=zilliz 但缺少配置：" + ", ".join(missing))
        self.client = ZillizClient(settings.zilliz_uri, settings.zilliz_token, settings.zilliz_db_name)
        self.collection = sanitize_collection_name(settings.rag_vector_collection, settings.rag_index_version)
        self.dimension = settings.rag_embedding_dimension

    async def _ensure_collection(self) -> None:
        await self.client.ensure_collection(self.collection, self.dimension)

    async def vector_search(self, user_id: str, file_ids: list[str], vector: list[float], limit: int) -> list[dict]:
        await self._ensure_collection()
        hits = await self.client.search(self.collection, vector, limit, build_filter(user_id, file_ids))
        if not hits:
            return []
        rows_by_id = await self._fetch_chunk_rows(user_id, [chunk_id for chunk_id, _ in hits])
        ordered: list[dict] = []
        for chunk_id, similarity in hits:
            row = rows_by_id.get(chunk_id)
            if row is None:
                continue
            row["score"] = similarity
            ordered.append(row)
        return ordered

    async def _fetch_chunk_rows(self, user_id: str, chunk_ids: list[str]) -> dict[str, dict]:
        rows = await self.db.fetch_all(
            """SELECT rc.id,rc.index_id,rc.file_id,f.original_name AS file_name,rc.chunk_index,
                      rc.content,rc.content_hash,rc.chunk_type,rc.page_start,rc.page_end,
                      rc.section_path,rc.extraction_method,rc.metadata
               FROM rag_chunks rc
               JOIN files f ON f.id=rc.file_id AND f.user_id=rc.user_id
               JOIN rag_indexes ri ON ri.id=rc.index_id AND ri.user_id=rc.user_id
               WHERE rc.user_id=$1 AND rc.id=ANY($2::varchar[]) AND ri.status='completed'
                 AND ri.embedding_provider=$3 AND ri.embedding_model=$4 AND ri.embedding_dimension=$5
                 AND ri.chunking_version=$6 AND ri.index_version=$7""",
            user_id, chunk_ids, *self.index_config,
        )
        return {row["id"]: row for row in _serialize_rows(rows)}

    async def upsert_chunks(self, user_id: str, file_id: str, index_id: str, chunks: list[dict]) -> None:
        """索引完成时把向量写入 Zilliz；同一文件只保留一套活跃向量（先清旧再写，即重索引替换）。"""
        await self._ensure_collection()
        await self.client.delete(
            self.collection,
            f"user_id == {_quote(user_id)} && file_id == {_quote(file_id)}",
        )
        rows = [
            {_PK_FIELD: chunk["id"], _VECTOR_FIELD: chunk["embedding"],
             "user_id": user_id, "file_id": file_id, "index_id": index_id}
            for chunk in chunks
        ]
        for start in range(0, len(rows), _UPSERT_BATCH_SIZE):
            await self.client.upsert(self.collection, rows[start:start + _UPSERT_BATCH_SIZE])

    async def delete_file(self, user_id: str, file_id: str) -> None:
        await self._ensure_collection()
        await self.client.delete(
            self.collection,
            f"user_id == {_quote(user_id)} && file_id == {_quote(file_id)}",
        )

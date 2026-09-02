import json

import httpx
import pytest

from app.services.embedding_service import EmbeddingService


class FakeLLMService:
    async def _get_api_key(self, provider: str, user_id: str | None):
        assert provider == "dashscope"
        return "test-key"


def build_service(monkeypatch) -> EmbeddingService:
    monkeypatch.setenv("DASHSCOPE_EMBEDDING_BASE_URL", "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1")
    monkeypatch.setenv("RAG_EMBEDDING_MODEL", "text-embedding-v4")
    monkeypatch.setenv("RAG_EMBEDDING_DIMENSION", "1024")
    monkeypatch.setenv("RAG_EMBEDDING_BATCH_SIZE", "10")
    monkeypatch.setenv("RAG_EMBEDDING_BATCH_MAX_TOKENS", "8192")
    from app.config import get_settings
    get_settings.cache_clear()
    return EmbeddingService(FakeLLMService())


def test_build_batches_enforces_item_limit(monkeypatch):
    service = build_service(monkeypatch)
    batches = service._build_batches([f"片段 {index}" for index in range(11)])
    assert [len(batch) for batch in batches] == [10, 1]


def test_build_batches_enforces_token_budget(monkeypatch):
    service = build_service(monkeypatch)
    service.settings.rag_embedding_batch_max_tokens = 10
    batches = service._build_batches(["1234567890", "abcdefghij", "x"])
    assert [len(batch) for batch in batches] == [1, 1, 1]


def test_build_batches_rejects_oversized_text(monkeypatch):
    service = build_service(monkeypatch)
    service.settings.rag_embedding_batch_max_tokens = 4
    with pytest.raises(ValueError, match="超过 Embedding 上限"):
        service._build_batches(["这是过长片段"])


@pytest.mark.asyncio
async def test_embed_batch_uses_workspace_v4_endpoint(monkeypatch):
    service = build_service(monkeypatch)
    captured = {}

    async def fake_post(_client, url, *, headers, json):
        captured.update(url=url, headers=headers, payload=json)
        return httpx.Response(
            200,
            json={"data": [{"index": 0, "embedding": [0.0] * 1024}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    vectors = await service.embed_texts(["测试文本"], "user-1")

    assert len(vectors) == 1
    assert captured["url"] == "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/embeddings"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["payload"] == {
        "model": "text-embedding-v4",
        "input": ["测试文本"],
        "dimensions": 1024,
        "encoding_format": "float",
    }


@pytest.mark.asyncio
async def test_embed_batch_preserves_dashscope_error_details(monkeypatch):
    service = build_service(monkeypatch)

    async def fake_post(_client, url, *, headers, json):
        return httpx.Response(
            400,
            headers={"x-request-id": "req-123"},
            content=json_module.dumps({"error": {"code": "invalid_api_key", "message": "Incorrect API key provided."}}).encode(),
            request=httpx.Request("POST", url),
        )

    json_module = json
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    with pytest.raises(ValueError) as exc_info:
        await service.embed_texts(["测试文本"], "user-1")

    message = str(exc_info.value)
    assert "invalid_api_key" in message
    assert "Incorrect API key provided." in message
    assert "req-123" in message
    assert "test-key" not in message

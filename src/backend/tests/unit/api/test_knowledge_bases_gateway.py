"""知识库资源 API 到独立 RAG 服务的渐进代理测试。"""
from unittest.mock import AsyncMock

import pytest

from app.api import knowledge_bases
from app.config import Settings


@pytest.fixture
def rag_settings():
    return Settings(
        _env_file=None,
        rag_service_enabled=True,
        rag_service_url="http://rag.local",
        rag_internal_token="12345678901234567890123456789012",
    )


@pytest.mark.asyncio
async def test_resource_request_uses_trusted_user_and_preserves_payload(monkeypatch, rag_settings):
    request = AsyncMock(return_value={"success": True, "data": {"id": "kb-1"}})
    monkeypatch.setattr(knowledge_bases, "get_settings", lambda: rag_settings)
    monkeypatch.setattr(knowledge_bases.RagServiceClient, "request", request)

    response = await knowledge_bases._resource_request(
        "POST",
        "/internal/v1/knowledge-bases",
        "user-1",
        payload={"name": "测试知识库"},
    )

    assert response == {"success": True, "data": {"id": "kb-1"}}
    request.assert_awaited_once_with(
        "POST",
        "/internal/v1/knowledge-bases",
        "user-1",
        json={"name": "测试知识库"},
        params=None,
    )


@pytest.mark.asyncio
async def test_resource_request_returns_none_when_feature_disabled(monkeypatch):
    monkeypatch.setattr(
        knowledge_bases,
        "get_settings",
        lambda: Settings(_env_file=None, rag_service_enabled=False),
    )

    response = await knowledge_bases._resource_request(
        "GET", "/internal/v1/knowledge-bases", "user-1",
    )

    assert response is None

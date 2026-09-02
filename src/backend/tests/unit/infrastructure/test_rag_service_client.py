"""独立 RAG 服务 HTTP 客户端测试。"""

import httpx
import pytest

from app.infrastructure.rag_service_client import RagServiceClient, RagServiceUnavailableError
from app.utils.exceptions import AppError


@pytest.mark.asyncio
async def test_request_propagates_trusted_identity(monkeypatch):
    captured = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["headers"] = request.headers
        return httpx.Response(200, json={"success": True, "data": {"items": []}})

    client = RagServiceClient(
        "http://rag.local",
        "secret-token",
        transport=httpx.MockTransport(handler),
    )
    result = await client.request("GET", "/internal/v1/knowledge-bases", "user-1", request_id="req-1")

    assert result["success"] is True
    assert captured["headers"]["authorization"] == "Bearer secret-token"
    assert captured["headers"]["x-authenticated-user-id"] == "user-1"
    assert captured["headers"]["x-request-id"] == "req-1"


@pytest.mark.asyncio
async def test_request_maps_network_error_to_service_unavailable(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline", request=request)

    client = RagServiceClient(
        "http://rag.local",
        "secret-token",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(RagServiceUnavailableError):
        await client.request("GET", "/internal/v1/knowledge-bases", "user-1")


@pytest.mark.asyncio
async def test_request_preserves_service_error_code():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={
            "success": False,
            "code": "KNOWLEDGE_BASE_NAME_EXISTS",
            "message": "同名知识库已存在",
            "request_id": "req-1",
            "retryable": False,
        })

    client = RagServiceClient(
        "http://rag.local",
        "secret-token",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(AppError) as captured:
        await client.request("POST", "/internal/v1/knowledge-bases", "user-1", json={"name": "重复"})

    assert captured.value.status_code == 409
    assert captured.value.code == "KNOWLEDGE_BASE_NAME_EXISTS"
    assert captured.value.message == "同名知识库已存在"

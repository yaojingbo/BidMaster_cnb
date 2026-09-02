"""FastAPI 到独立 RAG 服务的受保护 HTTP/SSE 客户端。"""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.utils.exceptions import AppError


class RagServiceUnavailableError(AppError):
    """独立 RAG 服务不可用。"""

    def __init__(self, message: str = "知识库服务暂时不可用，请稍后重试"):
        super().__init__(message, status_code=503)


class RagServiceClient:
    def __init__(
        self,
        base_url: str,
        token: str,
        timeout_seconds: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = httpx.Timeout(timeout_seconds, connect=min(timeout_seconds, 5.0))
        self.transport = transport

    def _headers(self, user_id: str, request_id: str | None = None) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "X-Authenticated-User-Id": user_id,
            "X-Request-Id": request_id or str(uuid.uuid4()),
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def request(
        self,
        method: str,
        path: str,
        user_id: str,
        *,
        request_id: str | None = None,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                transport=self.transport,
            ) as client:
                response = await client.request(
                    method,
                    path,
                    headers=self._headers(user_id, request_id),
                    json=json,
                    params=params,
                )
        except httpx.HTTPError as exc:
            raise RagServiceUnavailableError() from exc

        payload = self._safe_payload(response)
        if response.is_error:
            message = payload.get("message") if isinstance(payload, dict) else None
            code = payload.get("code") if isinstance(payload, dict) else None
            raise AppError(
                message or "知识库服务请求失败",
                status_code=response.status_code,
                code=code,
            )
        if not isinstance(payload, dict):
            raise RagServiceUnavailableError("知识库服务返回了无效响应")
        return payload

    async def stream(
        self,
        path: str,
        user_id: str,
        payload: dict[str, Any],
        *,
        request_id: str | None = None,
    ) -> AsyncIterator[bytes]:
        client = httpx.AsyncClient(base_url=self.base_url, timeout=None, transport=self.transport)
        try:
            async with client.stream(
                "POST",
                path,
                headers={**self._headers(user_id, request_id), "Accept": "text/event-stream"},
                json=payload,
            ) as response:
                if response.is_error:
                    body = await response.aread()
                    message = "知识库流式请求失败"
                    try:
                        parsed = response.json()
                        message = parsed.get("message", message)
                    except (ValueError, AttributeError):
                        if body:
                            message = "知识库服务返回错误"
                    raise AppError(message, status_code=response.status_code)
                async for chunk in response.aiter_bytes():
                    if chunk:
                        yield chunk
        except httpx.HTTPError as exc:
            raise RagServiceUnavailableError() from exc
        finally:
            await client.aclose()

    @staticmethod
    def _safe_payload(response: httpx.Response) -> Any:
        if not response.content:
            return {}
        try:
            return response.json()
        except ValueError:
            return None

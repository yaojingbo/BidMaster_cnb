"""DashScope 文本向量服务。"""
from __future__ import annotations

import asyncio
import math
from typing import Protocol

import httpx

from app.config import get_settings
from app.infrastructure.llm.lite_llm import LiteLLMService


class EmbeddingProvider(Protocol):
    async def embed_texts(self, texts: list[str], user_id: str | None = None) -> list[list[float]]: ...


class EmbeddingService:
    def __init__(self, llm_service: LiteLLMService | None = None):
        self.settings = get_settings()
        self.llm_service = llm_service or LiteLLMService()

    async def embed_texts(self, texts: list[str], user_id: str | None = None) -> list[list[float]]:
        if not texts:
            return []
        if self.settings.rag_embedding_provider != "dashscope":
            raise ValueError("首期知识库仅支持 DashScope Embedding")
        results: list[list[float]] = []
        for batch in self._build_batches(texts):
            results.extend(await self._embed_batch(batch, user_id))
        return results

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        # 无本地官方 tokenizer 时按 UTF-8 字节数作为安全上界；BPE token 不会超过输入字节数。
        return max(1, len(text.encode("utf-8")))

    def _build_batches(self, texts: list[str]) -> list[list[str]]:
        max_items = min(10, max(1, self.settings.rag_embedding_batch_size))
        max_tokens = min(8192, max(1, self.settings.rag_embedding_batch_max_tokens))
        batches: list[list[str]] = []
        current: list[str] = []
        current_tokens = 0
        for text in texts:
            token_count = self._estimate_tokens(text)
            if token_count > max_tokens:
                raise ValueError(f"单个文本片段估算为 {token_count} tokens，超过 Embedding 上限 {max_tokens}")
            if current and (len(current) >= max_items or current_tokens + token_count > max_tokens):
                batches.append(current)
                current = []
                current_tokens = 0
            current.append(text)
            current_tokens += token_count
        if current:
            batches.append(current)
        return batches

    async def _embed_batch(self, texts: list[str], user_id: str | None) -> list[list[float]]:
        api_key = await self.llm_service._get_api_key("dashscope", user_id)
        base_url = self.settings.dashscope_embedding_base_url.strip()
        if not base_url:
            raise ValueError("未配置 DASHSCOPE_EMBEDDING_BASE_URL，请填写北京地域业务空间专属地址")
        url = f"{base_url.rstrip('/')}/embeddings"
        payload = {
            "model": self.settings.rag_embedding_model,
            "input": texts,
            "dimensions": self.settings.rag_embedding_dimension,
            "encoding_format": "float",
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
                    response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 429 or response.status_code >= 500:
                    raise RuntimeError(f"DashScope Embedding 暂时不可用（HTTP {response.status_code}）")
                if response.status_code != 200:
                    raise ValueError(self._format_error(response))
                data = response.json().get("data", [])
                data = sorted(data, key=lambda item: item.get("index", 0))
                vectors = [item.get("embedding", []) for item in data]
                self._validate_vectors(vectors, len(texts))
                return vectors
            except (httpx.TimeoutException, httpx.ConnectError, RuntimeError) as exc:
                last_error = exc
                if attempt == 2:
                    break
                await asyncio.sleep(0.5 * (2 ** attempt))
        raise RuntimeError(f"生成文本向量失败: {last_error}")

    @staticmethod
    def _format_error(response: httpx.Response) -> str:
        request_id = response.headers.get("x-request-id") or response.headers.get("request-id")
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        error = payload.get("error", payload) if isinstance(payload, dict) else {}
        code = error.get("code") if isinstance(error, dict) else None
        message = error.get("message") if isinstance(error, dict) else None
        details = [f"HTTP {response.status_code}"]
        if code:
            details.append(str(code)[:100])
        if message:
            details.append(str(message)[:500])
        if request_id:
            details.append(f"request_id={request_id[:100]}")
        return f"DashScope Embedding 调用失败（{'；'.join(details)}）"

    def _validate_vectors(self, vectors: list[list[float]], expected_count: int) -> None:
        if len(vectors) != expected_count:
            raise ValueError("Embedding 返回数量与输入数量不一致")
        dimension = self.settings.rag_embedding_dimension
        for vector in vectors:
            if len(vector) != dimension:
                raise ValueError(f"Embedding 维度必须为 {dimension}")
            if not all(isinstance(value, (int, float)) and math.isfinite(value) for value in vector):
                raise ValueError("Embedding 包含非法数值")

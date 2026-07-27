from __future__ import annotations
"""
LiteLLM integration for multi-provider LLM support.
"""
import json as _json
import logging
import time
from typing import AsyncGenerator, Any

import httpx
from app.config import get_settings
from app.infrastructure.log_collector import add_log as _add_log

logger = logging.getLogger(__name__)


class LiteLLMService:
    """LLM service using LiteLLM for unified multi-provider access."""

    # Model mappings - must use litellm provider prefix format
    MODEL_MAP = {
        "openai": "openai/gpt-4o",
        "deepseek": "deepseek/deepseek-chat",
        "claude": "anthropic/claude-sonnet-4-20250514",
        "dashscope": "openai/qwen3.6-plus",
        "zhipu": "openai/glm-4-flash",
        "minimax": "openai/MiniMax-M3",
        "ollama": "ollama/llama3",
    }

    # 这些供应商通过 httpx 直接调用 OpenAI 兼容 API，
    # 不经过 OpenAI SDK（Pydantic 响应校验与第三方不完全兼容）
    # 也不经过 LiteLLM（openai/ 前缀无法可靠转发 api_base）
    OPENAI_COMPATIBLE_PROVIDERS = {"zhipu", "dashscope", "minimax"}
    MINIMAX_STREAM_DISABLED = True

    def __init__(self):
        self.settings = get_settings()

    async def _demo_complete(self, messages: list[dict], stream: bool = True) -> AsyncGenerator[str, None]:
        user_text = "\n".join(str(message.get("content", "")) for message in messages if message.get("role") == "user")
        if "JSON" in user_text or "json" in user_text or "elements" in user_text:
            text = _json.dumps(
                {
                    "elements": [
                        {"name": "项目基本信息", "content": "本地 demo 模式已读取上传文件，可继续验证要素提取流程。"},
                        {"name": "资质要求", "content": "投标人需具备与项目相匹配的资质条件，具体以招标文件为准。"},
                        {"name": "评标办法", "content": "建议重点核对价格分、技术分、商务分及否决条款。"},
                    ]
                },
                ensure_ascii=False,
            )
        else:
            text = "\n".join([
                "## 本地 demo 分析结果",
                "- 已在不调用外部 AI 的情况下完成演示流程。",
                "- 上传、解析、任务推进和结果展示链路可用于本地功能验证。",
                "- 正式分析请在 AI 设置中配置可用供应商 API Key。",
            ])

        if stream:
            for index in range(0, len(text), 24):
                yield text[index:index + 24]
        else:
            yield text

    async def _get_api_key(self, provider: str, user_id: str = None) -> str:
        """Get API key for provider. Checks user-stored key first, then falls back to env vars."""
        if user_id:
            try:
                from app.infrastructure.pg_storage import get_api_key as _get_user_key
                encrypted = await _get_user_key(user_id, provider)
                if encrypted:
                    from app.services.encryption_service import get_encryption_service
                    key = get_encryption_service().decrypt(encrypted.encode()).decode().strip()
                    logger.info("使用用户存储的 %s API Key: %s...%s", provider, key[:6], key[-4:] if len(key) > 10 else "")
                    return key
            except Exception as e:
                logger.warning("解密 %s API Key 失败（user_id=%s）: %s，将回退到环境变量", provider, user_id, e)

        # 2. Fall back to environment variable
        key_map = {
            "openai": self.settings.openai_api_key,
            "deepseek": self.settings.deepseek_api_key,
            "claude": self.settings.claude_api_key,
            "dashscope": self.settings.dashscope_api_key,
            "zhipu": self.settings.zhipu_api_key,
            "minimax": self.settings.minimax_api_key,
            "ollama": self.settings.ollama_base_url,
        }
        key = key_map.get(provider, "")
        if not key and provider != "ollama":
            raise ValueError(f"未配置 {provider} 的 API Key，请在「AI 设置」中添加")
        return key

    def _get_model_name(self, provider: str, model: str = None) -> str:
        """Get model name for provider with litellm prefix format."""
        if model:
            # If model already has provider prefix, use as-is
            if "/" in model:
                return model
            # Otherwise add provider prefix for litellm
            provider_prefixes = {
                "deepseek": "deepseek/",
                "openai": "openai/",
                "claude": "anthropic/",
                "dashscope": "openai/",
                "zhipu": "openai/",
                "minimax": "openai/",
                "ollama": "ollama/",
            }
            prefix = provider_prefixes.get(provider, f"{provider}/")
            return f"{prefix}{model}"
        return self.MODEL_MAP.get(provider, "gpt-4o")

    async def _complete_via_openai_compat(
        self,
        provider: str,
        messages: list[dict],
        model: str = None,
        stream: bool = True,
        user_id: str = None,
        api_key_override: str = None,
        temperature: float = None,
    ) -> AsyncGenerator[str, None]:
        """通过 httpx 直接调用第三方 OpenAI 兼容 API（绕过 OpenAI SDK 的 Pydantic 校验）。"""
        model_name = self._get_model_name(provider, model)
        if "/" in model_name:
            model_name = model_name.split("/", 1)[1]

        api_key = api_key_override or await self._get_api_key(provider, user_id)
        if not api_key:
            raise ValueError(f"未配置 {provider} 的 API Key，请在设置页面填写后保存")

        base_url = {
            "zhipu": self.settings.zhipu_base_url,
            "dashscope": self.settings.dashscope_base_url,
            "minimax": self.settings.minimax_base_url,
        }[provider].rstrip("/")

        url = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": stream,
        }
        if temperature is not None:
            payload["temperature"] = temperature

        logger.info("调用 %s API: model=%s, base_url=%s", provider, model_name, base_url)
        timeout = httpx.Timeout(180.0, connect=10.0)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                if stream:
                    async with client.stream("POST", url, json=payload, headers=headers) as response:
                        if response.status_code != 200:
                            error_body = await response.aread()
                            error_msg = _parse_api_error(error_body, response.status_code)
                            raise RuntimeError(error_msg)

                        in_think = False
                        async for line in response.aiter_lines():
                            if not line.startswith("data: "):
                                continue
                            data = line[6:]
                            if data.strip() == "[DONE]":
                                break
                            try:
                                chunk = _json.loads(data)
                                if "error" in chunk:
                                    err_detail = chunk["error"]
                                    if isinstance(err_detail, dict):
                                        err_msg = err_detail.get("message", str(err_detail))
                                    else:
                                        err_msg = str(err_detail)
                                    logger.error("API 流式错误 (%s): %s", provider, err_msg)
                                    raise RuntimeError(f"{provider} API 错误: {err_msg}")
                                choices = chunk.get("choices", [])
                                if not choices:
                                    continue
                                delta = choices[0].get("delta", {})
                                # qwen3.x 思考模式：跳过 reasoning_content，只输出 content
                                content = delta.get("content", "")
                                if content:
                                    if "<think>" in content:
                                        in_think = True
                                        before = content.split("<think>")[0]
                                        if before:
                                            yield before
                                        continue
                                    if "</think>" in content:
                                        in_think = False
                                        after = content.split("</think>", 1)[1]
                                        if after:
                                            yield after
                                        continue
                                    if in_think:
                                        continue
                                    yield content
                            except _json.JSONDecodeError:
                                continue
                else:
                    response = await client.post(url, json=payload, headers=headers)
                    if response.status_code != 200:
                        error_msg = _parse_api_error(response.content, response.status_code)
                        raise RuntimeError(error_msg)

                    result = response.json()
                    choices = result.get("choices", [])
                    if not choices:
                        yield ""
                        return
                    msg = choices[0].get("message", {})
                    # qwen3.x 思考模式：优先取 content，忽略 reasoning_content
                    content = msg.get("content", "")
                    yield content

        except httpx.TimeoutException:
            raise RuntimeError(f"{provider} API 请求超时，请检查网络连接或稍后重试")
        except httpx.ConnectError:
            raise RuntimeError(f"无法连接到 {provider} API（{base_url}），请检查网络或 API 地址是否正确")
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(f"调用 {provider} API 失败: {e}") from e

    @staticmethod
    def _is_retryable_stream_error(error: Exception) -> bool:
        message = str(error).lower()
        retryable_signals = [
            "incomplete chunked read",
            "peer closed connection",
            "server disconnected",
            "connection reset",
            "response ended prematurely",
        ]
        return any(signal in message for signal in retryable_signals)

    async def complete(
        self,
        provider: str,
        messages: list[dict],
        model: str = None,
        stream: bool = True,
        user_id: str = None,
        api_key_override: str = None,
        temperature: float = None,
    ) -> AsyncGenerator[str, None] | str:
        """
        Call LLM with messages.

        Args:
            provider: LLM provider name
            messages: Chat messages
            model: Optional model override
            stream: Whether to stream response
            user_id: Optional user ID for per-user API key lookup
            api_key_override: Optional API key override (bypasses stored/env key lookup)
            temperature: Optional sampling temperature (0.0-2.0, lower = more deterministic)

        Yields:
            Response chunks if streaming
        """
        if self.settings.demo_mode is True or self.settings.auth_disabled is True:
            async for chunk in self._demo_complete(messages, stream):
                yield chunk
            return

        # OpenAI 兼容第三方供应商走 httpx 直接调用
        if provider in self.OPENAI_COMPATIBLE_PROVIDERS:
            resolved_model = self._get_model_name(provider, model)
            if "/" in resolved_model:
                resolved_model = resolved_model.split("/", 1)[1]
            _add_log("info", "llm_call", f"{provider}/{resolved_model} 调用开始 (openai_compat)", user_id=user_id)
            try:
                async for chunk in self._complete_via_openai_compat(provider, messages, model, stream, user_id, api_key_override=api_key_override, temperature=temperature):
                    yield chunk
            except Exception as e:
                if stream and self._is_retryable_stream_error(e):
                    _add_log("warning", "llm_call", f"{provider}/{resolved_model} 流式中断，自动改用非流式重试", user_id=user_id)
                    async for chunk in self._complete_via_openai_compat(provider, messages, model, False, user_id, api_key_override=api_key_override, temperature=temperature):
                        yield chunk
                    return
                _add_log("error", "llm_call", f"{provider}/{resolved_model} 调用失败: {str(e)[:200]}", user_id=user_id)
                raise
            return

        try:
            from litellm import acompletion

            model_name = self._get_model_name(provider, model)
            api_key = api_key_override or await self._get_api_key(provider, user_id)
            _add_log("info", "llm_call", f"{provider}/{model_name} 调用开始", user_id=user_id)

            # Configure based on provider
            kwargs = {
                "model": model_name,
                "messages": messages,
                "stream": stream,
            }

            if temperature is not None:
                kwargs["temperature"] = temperature

            # API key: all providers except ollama
            if provider != "ollama":
                kwargs["api_key"] = api_key

            # API base URL: providers with custom endpoints
            api_base_map = {
                "deepseek": self.settings.deepseek_base_url,
                "ollama": self.settings.ollama_base_url,
                "zhipu": self.settings.zhipu_base_url,
                "dashscope": self.settings.dashscope_base_url,
                "minimax": self.settings.minimax_base_url,
            }
            if provider in api_base_map:
                kwargs["api_base"] = api_base_map[provider]

            response = await acompletion(**kwargs)

            if stream:
                in_think = False
                async for chunk in response:
                    if not chunk.choices:
                        continue
                    content = chunk.choices[0].delta.content
                    if content:
                        if "<think>" in content:
                            in_think = True
                            before = content.split("<think>")[0]
                            if before:
                                yield before
                            continue
                        if "</think>" in content:
                            in_think = False
                            after = content.split("</think>", 1)[1]
                            if after:
                                yield after
                            continue
                        if in_think:
                            continue
                        yield content
            else:
                yield response.choices[0].message.content if response.choices else ""

        except Exception as e:
            _add_log("error", "llm_call", f"{provider} 调用失败: {str(e)[:200]}", user_id=user_id)
            raise

    async def test_connection(self, provider: str, user_id: str = None, model: str = None, api_key: str = None) -> dict[str, Any]:
        """
        Test connection to a provider.

        Args:
            provider: Provider name
            user_id: Optional user ID for per-user API key lookup
            model: Optional model name to test with
            api_key: Optional API key override (for testing before saving)

        Returns:
            Dict with success status, latency, and optional error
        """
        # 先检查是否有可用的 API Key
        effective_key = api_key or await self._get_api_key(provider, user_id)
        if not effective_key and provider != "ollama":
            return {
                "success": False,
                "error": f"未配置 {provider} 的 API Key，请在设置页面填写后保存",
                "message": "Connection failed",
            }

        start_time = time.time()

        try:
            messages = [{"role": "user", "content": "Hi"}]
            response_text = ""
            async for chunk in self.complete(provider, messages, model=model, stream=False, user_id=user_id, api_key_override=effective_key):
                response_text += chunk

            if response_text.startswith("Error:"):
                return {
                    "success": False,
                    "error": response_text,
                    "message": "Connection failed",
                }

            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "success": True,
                "message": "Connection successful",
                "latencyMs": latency_ms,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Connection failed",
            }

    @staticmethod
    def get_providers() -> list[dict]:
        """Get list of supported providers with their models."""
        return [
            {
                "id": "deepseek",
                "name": "DeepSeek",
                "models": ["deepseek-chat", "deepseek-reasoner"],
            },
            {
                "id": "dashscope",
                "name": "阿里百炼",
                "models": [
                    "qwen3.7-max", "qwen3.6-plus", "qwen3.6-flash",
                    "qwen-max", "qwen-plus", "qwen-turbo", "qwen-coder-turbo",
                    "qwen-vl-ocr", "qwen3-vl-plus", "qwen-vl-plus", "qwen-vl-max",
                ],
            },
            {
                "id": "zhipu",
                "name": "智谱 AI",
                "models": ["glm-4-flash", "glm-4-air", "glm-4-plus", "glm-5.1", "glm-4v", "glm-4v-plus"],
            },
            {
                "id": "minimax",
                "name": "MiniMax",
                "models": ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.5", "MiniMax-M2-Her"],
            },
            {
                "id": "openai",
                "name": "OpenAI",
                "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
            },
            {
                "id": "claude",
                "name": "Claude",
                "models": ["claude-sonnet-4-20250514", "claude-opus-4-5-20251101"],
            },
            {
                "id": "ollama",
                "name": "Ollama (本地)",
                "models": ["llama3", "mixtral", "codellama"],
            },
        ]


def _parse_api_error(body: bytes, status_code: int) -> str:
    """解析第三方 API 的错误响应，返回可读的错误消息。"""
    try:
        error_json = _json.loads(body)
        # OpenAI 标准格式: {"error": {"message": "...", "type": "..."}}
        if "error" in error_json:
            err = error_json["error"]
            if isinstance(err, dict):
                msg = err.get("message", str(err))
                err_type = err.get("type", "")
                if err_type:
                    return f"API 错误 ({status_code}): {msg}（{err_type}）"
                return f"API 错误 ({status_code}): {msg}"
            return f"API 错误 ({status_code}): {err}"
        # 其他格式
        return f"API 错误 ({status_code}): {_json.dumps(error_json, ensure_ascii=False)[:200]}"
    except Exception:
        return f"API 错误 ({status_code}): {body.decode(errors='replace')[:200]}"


# Global LLM service instance
_llm_service: LiteLLMService | None = None


def get_llm_service() -> LiteLLMService:
    """Get or create LLM service instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LiteLLMService()
    return _llm_service

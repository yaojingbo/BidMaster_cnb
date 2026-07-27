"""
LLM service unit tests.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from app.infrastructure.llm.lite_llm import LiteLLMService


class TestLiteLLMServiceModelMapping:
    """Tests for LiteLLMService model name mapping."""

    @pytest.fixture
    def service(self):
        """Create service with mock settings."""
        with patch("app.infrastructure.llm.lite_llm.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                openai_api_key="test-key",
                deepseek_api_key="test-key",
                claude_api_key="test-key",
                dashscope_api_key="test-key",
                zhipu_api_key="test-key",
                minimax_api_key="test-key",
                ollama_base_url="http://localhost:11434",
                demo_mode=False,
                auth_disabled=False,
            )
            return LiteLLMService()

    def test_model_mapping_deepseek(self, service):
        """默认模型应返回 litellm provider/model 格式。"""
        assert service._get_model_name("deepseek") == "deepseek/deepseek-chat"

    def test_model_mapping_dashscope(self, service):
        assert service._get_model_name("dashscope") == "openai/qwen3.6-plus"

    def test_model_mapping_zhipu(self, service):
        assert service._get_model_name("zhipu") == "openai/glm-4-flash"

    def test_model_mapping_minimax(self, service):
        assert service._get_model_name("minimax") == "openai/MiniMax-M3"

    def test_model_mapping_openai(self, service):
        assert service._get_model_name("openai") == "openai/gpt-4o"

    def test_model_mapping_claude(self, service):
        assert service._get_model_name("claude") == "anthropic/claude-sonnet-4-20250514"

    def test_model_mapping_ollama(self, service):
        assert service._get_model_name("ollama") == "ollama/llama3"

    def test_model_mapping_unknown_provider_defaults(self, service):
        """未知供应商应默认为 gpt-4o。"""
        assert service._get_model_name("unknown_provider") == "gpt-4o"

    def test_model_override(self, service):
        """指定裸 model 名时应自动添加 provider 前缀。"""
        assert service._get_model_name("deepseek", "deepseek-v4-pro") == "deepseek/deepseek-v4-pro"

    def test_model_override_with_prefix(self, service):
        """已带前缀的 model 名应原样返回。"""
        assert service._get_model_name("deepseek", "deepseek/deepseek-v4-flash") == "deepseek/deepseek-v4-flash"


class TestLiteLLMServiceProviders:
    """Tests for provider list and API key retrieval."""

    def test_get_providers_returns_seven_providers(self):
        """供应商列表应包含 7 个供应商。"""
        providers = LiteLLMService.get_providers()
        assert len(providers) == 7

    def test_get_providers_has_required_fields(self):
        """每个供应商应包含 id、name、models 字段。"""
        providers = LiteLLMService.get_providers()
        for provider in providers:
            assert "id" in provider
            assert "name" in provider
            assert "models" in provider

    def test_get_providers_ids(self):
        """供应商 ID 应包含 deepseek、dashscope、zhipu、minimax、openai、claude、ollama。"""
        providers = LiteLLMService.get_providers()
        ids = [p["id"] for p in providers]
        expected = ["deepseek", "dashscope", "zhipu", "minimax", "openai", "claude", "ollama"]
        assert set(ids) == set(expected)

    @pytest.fixture
    def service(self):
        """Create service with mock settings."""
        with patch("app.infrastructure.llm.lite_llm.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                openai_api_key="sk-openai-test",
                deepseek_api_key="sk-deepseek-test",
                claude_api_key="sk-claude-test",
                dashscope_api_key="sk-dashscope-test",
                zhipu_api_key="sk-zhipu-test",
                minimax_api_key="sk-minimax-test",
                ollama_base_url="http://localhost:11434",
                demo_mode=False,
                auth_disabled=False,
            )
            return LiteLLMService()

    @pytest.mark.asyncio
    async def test_get_api_key_deepseek(self, service):
        """应正确获取 DeepSeek API Key。"""
        assert await service._get_api_key("deepseek") == "sk-deepseek-test"

    @pytest.mark.asyncio
    async def test_get_api_key_openai(self, service):
        """应正确获取 OpenAI API Key。"""
        assert await service._get_api_key("openai") == "sk-openai-test"

    @pytest.mark.asyncio
    async def test_get_api_key_unknown_provider(self, service):
        """未知供应商且无 Key 时应抛出配置错误。"""
        with pytest.raises(ValueError, match="未配置 unknown 的 API Key"):
            await service._get_api_key("unknown")


class TestLiteLLMServiceComplete:
    """Tests for LLM completion with mocked acompletion."""

    @pytest.fixture
    def service(self):
        """Create service with mock settings."""
        with patch("app.infrastructure.llm.lite_llm.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                openai_api_key="test-key",
                deepseek_api_key="test-key",
                claude_api_key="test-key",
                dashscope_api_key="test-key",
                zhipu_api_key="test-key",
                minimax_api_key="test-key",
                ollama_base_url="http://localhost:11434",
                demo_mode=False,
                auth_disabled=False,
            )
            return LiteLLMService()

    @pytest.mark.asyncio
    async def test_complete_returns_content(self, service):
        """非流式调用应返回内容字符串。"""
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Test response"

        with patch("litellm.acompletion", new_callable=AsyncMock) as mock_complete:
            mock_complete.return_value = mock_response
            result = ""
            async for chunk in service.complete("openai", [{"role": "user", "content": "test"}], stream=False):
                result += chunk
            assert result == "Test response"

    @pytest.mark.asyncio
    async def test_openai_compat_stream_error_retries_without_stream(self, service):
        """OpenAI 兼容供应商流式连接中断时应自动非流式重试。"""
        calls = []

        async def fake_complete(provider, messages, model, stream, user_id, api_key_override=None, temperature=None):
            calls.append(stream)
            if stream:
                raise RuntimeError("peer closed connection without sending complete message body (incomplete chunked read)")
            yield "Retry response"

        with patch.object(service, "_complete_via_openai_compat", side_effect=fake_complete):
            result = ""
            async for chunk in service.complete("minimax", [{"role": "user", "content": "test"}], stream=True):
                result += chunk

        assert result == "Retry response"
        assert calls == [True, False]

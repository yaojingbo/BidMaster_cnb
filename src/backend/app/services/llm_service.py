from __future__ import annotations
"""
LLM service for AI-powered document analysis.
"""
from typing import AsyncGenerator, Optional

from app.infrastructure.llm.lite_llm import LiteLLMService


class LLMService:
    """Service for LLM interactions using LiteLLM."""

    def __init__(self, llm_service: LiteLLMService = None):
        self.llm = llm_service or LiteLLMService()

    async def analyze_statistics(
        self,
        prices: list[float],
        provider: str = "deepseek",
    ) -> dict:
        """
        Analyze price statistics.

        Args:
            prices: List of bid prices
            provider: LLM provider to use

        Returns:
            Statistical analysis results
        """
        from app.services.statistics_service import StatisticsService

        # Calculate statistics server-side
        return StatisticsService.calculate_price_statistics(prices)

    async def test_connection(self, provider: str, user_id: str = None, model: str = None, api_key: str = None) -> dict:
        """
        Test connection to a provider.

        Args:
            provider: Provider name
            user_id: Optional user ID for per-user API key lookup
            model: Optional model name to test with
            api_key: Optional API key override (for testing before saving)

        Returns:
            Test result with latency
        """
        return await self.llm.test_connection(provider, user_id, model, api_key=api_key)

    def get_providers(self) -> list[dict]:
        """Get list of supported providers."""
        return LiteLLMService.get_providers()


# Global LLM service instance
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    """Get or create LLM service instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
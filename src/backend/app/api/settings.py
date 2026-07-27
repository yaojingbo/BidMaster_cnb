"""
AI provider settings API routes.
"""
from fastapi import APIRouter, HTTPException, Depends

from app.services.llm_service import LLMService
from app.models.schemas import (
    ProvidersResponse,
    TestConnectionRequest,
    TestConnectionResponse,
    ProviderConfig,
)
from app.utils.auth_dep import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/providers")
async def get_providers():
    """
    Get list of supported AI providers.

    Returns:
        List of providers with their models
    """
    llm_service = LLMService()
    providers = llm_service.get_providers()

    return {
        "success": True,
        "data": {
            "providers": providers,
            "active": "deepseek",  # Default provider
        }
    }


@router.get("/providers/{provider_name}")
async def get_provider(provider_name: str):
    """
    Get specific provider configuration.

    Args:
        provider_name: Provider identifier

    Returns:
        Provider details
    """
    llm_service = LLMService()
    providers = llm_service.get_providers()

    for p in providers:
        if p["id"] == provider_name:
            return {
                "success": True,
                "data": p,
            }

    raise HTTPException(status_code=404, detail=f"Provider {provider_name} not found")


@router.post("/providers/{provider_name}")
async def configure_provider(provider_name: str, config: ProviderConfig):
    """
    Configure a provider.

    Args:
        provider_name: Provider identifier
        config: Provider configuration

    Returns:
        Success status
    """
    # TODO: Save to database
    return {
        "success": True,
        "message": f"Provider {provider_name} configured",
    }


@router.post("/test")
async def test_connection(request: TestConnectionRequest, user: dict = Depends(get_current_user)):
    """Test connection to an AI provider."""
    try:
        llm_service = LLMService()
        result = await llm_service.test_connection(
            request.provider, model=request.model, user_id=user["id"], api_key=request.apiKey
        )

        return {
            "success": result["success"],
            "message": result["message"],
            "latencyMs": result.get("latencyMs"),
            "error": result.get("error"),
        }
    except Exception as e:
        return {
            "success": False,
            "message": "Connection failed",
            "error": str(e),
        }
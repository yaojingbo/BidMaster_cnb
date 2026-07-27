"""
Health check API route.
"""
from fastapi import APIRouter
from datetime import datetime
import subprocess

from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


def _get_git_info() -> dict:
    """获取 git 信息用于部署验证。"""
    info = {}
    try:
        info["commit"] = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        info["commit"] = "unknown"
    try:
        info["branch"] = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        info["branch"] = "unknown"
    return info


@router.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns:
        Service health status
    """
    git_info = _get_git_info()
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "git": git_info,
    }


@router.get("/health/ocr")
async def ocr_health_check():
    """OCR runtime dependency check."""
    from app.services.ocrmypdf_service import get_ocrmypdf_status

    return {
        "status": "healthy" if get_ocrmypdf_status()["available"] else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "ocrmypdf": get_ocrmypdf_status(),
    }


@router.get("/")
async def root():
    """
    Root endpoint.

    Returns:
        API information
    """
    git_info = _get_git_info()
    return {
        "name": "Bid Master API",
        "version": "1.0.0",
        "docs": "/docs",
        "git": git_info,
    }
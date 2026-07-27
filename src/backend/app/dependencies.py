"""
Dependencies for FastAPI routes.
"""
from functools import lru_cache

from app.config import Settings


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
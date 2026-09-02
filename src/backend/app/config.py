"""
Configuration management for Bid Master Backend.
Reads settings from environment variables.
"""
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent


def _find_project_root(start: Path) -> Path:
    for path in (start, *start.parents):
        if (path / "package.json").exists() or (path / ".git").exists():
            return path
    return start


_PROJECT_ROOT = _find_project_root(_BACKEND_DIR)
_ENV_FILES = (
    _PROJECT_ROOT / ".env",
    _PROJECT_ROOT / ".env.local",
    _BACKEND_DIR / ".env",
    _BACKEND_DIR / ".env.local",
)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=_ENV_FILES, case_sensitive=False, extra="allow")

    # Database
    database_url: str = "postgresql://localhost:5432/bidmaster"

    # AI Provider: deepseek | dashscope | zhipu | minimax | openai | claude | ollama
    ai_provider: str = "deepseek"

    # LLM Providers API Keys
    deepseek_api_key: str = ""
    dashscope_api_key: str = ""
    zhipu_api_key: str = ""
    minimax_api_key: str = ""
    openai_api_key: str = ""
    claude_api_key: str = ""

    # LLM Providers API Base URLs (OpenAI-compatible providers need custom endpoints)
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    dashscope_embedding_base_url: str = ""
    zhipu_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    minimax_base_url: str = "https://api.minimaxi.com/v1"

    # Ollama (optional, for local)
    ollama_base_url: str = "http://localhost:11434"

    # Knowledge Base / RAG
    knowledge_base_enabled: bool = True
    rag_required: bool = False
    rag_test_mode: bool = False
    rag_service_enabled: bool = False
    rag_service_url: str = "http://127.0.0.1:8100"
    rag_internal_token: str = ""
    rag_service_timeout_seconds: float = 30.0
    rag_embedding_provider: str = "dashscope"
    rag_embedding_model: str = "text-embedding-v4"
    rag_embedding_dimension: int = 1024
    rag_embedding_batch_size: int = 10
    rag_embedding_batch_max_tokens: int = 8192
    rag_chunk_size: int = 1000
    rag_chunk_overlap: int = 160
    rag_min_chunk_chars: int = 80
    rag_vector_top_k: int = 30
    rag_keyword_top_k: int = 20
    rag_context_k: int = 8
    rag_rrf_k: int = 60
    rag_index_version: str = "v2-embedding-v4"
    rag_chunking_version: str = "v1"
    rag_index_concurrency: int = 2
    rag_task_stale_seconds: int = 900
    rag_archive_max_size: int = 50 * 1024 * 1024
    rag_archive_max_entries: int = 100
    rag_archive_max_pdf_files: int = 50
    rag_archive_max_entry_size: int = 50 * 1024 * 1024
    rag_archive_max_uncompressed_size: int = 250 * 1024 * 1024
    rag_archive_max_entry_ratio: float = 100.0
    rag_archive_max_total_ratio: float = 50.0
    rag_archive_max_path_depth: int = 10
    rag_archive_max_filename_bytes: int = 255

    # Encryption
    fernet_key: str = ""

    # JWT
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # Auth
    auth_disabled: bool = False
    demo_mode: bool = False

    # File storage
    upload_dir: str = "./uploads"
    max_file_size: int = 50 * 1024 * 1024  # 50MB

    # Allowed file types
    allowed_mime_types: list[str] = [
        "application/pdf",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
    ]

    # Email (Resend)
    resend_api_key: str = ""
    resend_from: str = "Bid Master <noreply@bidmaster.asia>"
    frontend_url: str = "http://localhost:3000"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:8000"

    # OCR
    ocr_save_evidence: bool = True
    ocr_evidence_dir: str = "tmp/ocr-evidence"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
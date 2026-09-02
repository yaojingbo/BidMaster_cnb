"""知识库与 RAG 的请求、响应和领域数据模型。"""
from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class RagIndexStatus(StrEnum):
    NOT_INDEXED = "not_indexed"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    STALE = "stale"


class RagJobStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    PARTIAL_FAILED = "partial_failed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("知识库名称不能为空")
        return value


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def normalize_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("知识库名称不能为空")
        return value


class KnowledgeBaseFileAdd(BaseModel):
    file_ids: list[str] = Field(min_length=1, max_length=100)

    @field_validator("file_ids")
    @classmethod
    def unique_file_ids(cls, value: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if not normalized:
            raise ValueError("至少需要一个有效文件 ID")
        return normalized


class RagIndexJobCreate(BaseModel):
    file_ids: list[str] = Field(min_length=1, max_length=100)
    force: bool = False

    @field_validator("file_ids")
    @classmethod
    def unique_index_file_ids(cls, value: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if not normalized:
            raise ValueError("至少需要一个有效文件 ID")
        return normalized


class KnowledgeSourceSelection(BaseModel):
    source_type: str = Field(max_length=40)
    source_ref_id: str = Field(min_length=1, max_length=64)
    source_variant: str = Field(min_length=1, max_length=50)


class KnowledgeSourceAdd(BaseModel):
    sources: list[KnowledgeSourceSelection] = Field(min_length=1, max_length=100)


class RagQueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    file_ids: list[str] | None = Field(default=None, max_length=100)
    provider: str | None = Field(default=None, max_length=50)
    model: str | None = Field(default=None, max_length=100)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("问题不能为空")
        return value


class RagChunk(BaseModel):
    id: str
    index_id: str
    file_id: str
    file_name: str = ""
    chunk_index: int
    content: str
    content_hash: str
    chunk_type: str = "text"
    page_start: int | None = None
    page_end: int | None = None
    section_path: str | None = None
    extraction_method: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    embedding: list[float] | None = None
    score: float = 0.0


class RagCitation(BaseModel):
    citation_id: int
    knowledge_base_id: str
    chunk_id: str
    file_id: str
    file_name: str
    page_start: int | None = None
    page_end: int | None = None
    section_path: str | None = None
    content_preview: str
    score: float


class RagExcludedFile(BaseModel):
    file_id: str
    file_name: str
    reason: str


class RagQueryResult(BaseModel):
    answer: str
    citations: list[RagCitation] = Field(default_factory=list)
    excluded_files: list[RagExcludedFile] = Field(default_factory=list)
    usage: dict[str, Any] = Field(default_factory=dict)
    refused: bool = False

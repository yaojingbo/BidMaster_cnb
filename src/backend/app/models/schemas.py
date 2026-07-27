"""
Pydantic models for API request/response schemas.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ============================================
# File Schemas
# ============================================
class FileUploadResponse(BaseModel):
    id: str
    name: str
    size: int
    type: str
    status: str
    createdAt: datetime


class FileListItem(BaseModel):
    id: str
    name: str
    size: int
    mimeType: str
    category: str
    status: str
    createdAt: datetime


class FileListResponse(BaseModel):
    files: list[FileListItem]
    total: int


# ============================================
# Analysis Schemas
# ============================================
class ExtractRequest(BaseModel):
    fileId: str
    provider: Optional[str] = "deepseek"
    model: Optional[str] = None
    template_type: Optional[str] = "standard"  # standard | brief | batch | threshold
    elements: Optional[list[str]] = None  # 指定提取的要素 key 列表，None=全部
    mode: Optional[str] = "single"  # single | batch | threshold
    ocr_engine: Optional[str] = "auto"  # llm | ocrmypdf | paddleocr | auto
    ocrEngine: Optional[str] = None
    ocr_pages: Optional[list[int]] = None
    ocrPages: Optional[list[int]] = None
    ocr_max_pages: Optional[int] = None
    ocrMaxPages: Optional[int] = None
    ocr_timeout_seconds: Optional[int] = 120
    ocrTimeoutSeconds: Optional[int] = None


class ElementData(BaseModel):
    name: str
    content: str
    confidence: Optional[int] = None
    position: Optional[dict] = None


class ExtractProgress(BaseModel):
    type: str = "progress"
    message: str


class ExtractElement(BaseModel):
    type: str = "element"
    data: ElementData


class ExtractDone(BaseModel):
    type: str = "done"
    data: dict


class ExtractError(BaseModel):
    type: str = "error"
    data: dict


class BatchExtractRequest(BaseModel):
    fileIds: list[str]
    provider: Optional[str] = "deepseek"
    model: Optional[str] = None
    elements: Optional[list[str]] = None
    ocr_engine: Optional[str] = "auto"
    ocrEngine: Optional[str] = None
    ocr_pages: Optional[list[int]] = None
    ocrPages: Optional[list[int]] = None
    ocr_max_pages: Optional[int] = None
    ocrMaxPages: Optional[int] = None
    ocr_timeout_seconds: Optional[int] = 120
    ocrTimeoutSeconds: Optional[int] = None


class ThresholdRequest(BaseModel):
    fileId: str
    userQualifications: str
    provider: Optional[str] = "deepseek"
    model: Optional[str] = None
    ocr_engine: Optional[str] = "auto"
    ocrEngine: Optional[str] = None
    ocr_pages: Optional[list[int]] = None
    ocrPages: Optional[list[int]] = None
    ocr_max_pages: Optional[int] = None
    ocrMaxPages: Optional[int] = None
    ocr_timeout_seconds: Optional[int] = 120
    ocrTimeoutSeconds: Optional[int] = None


# ============================================
# Settings Schemas
# ============================================
class ProviderInfo(BaseModel):
    id: str
    name: str
    models: list[str]


class ProvidersResponse(BaseModel):
    providers: list[ProviderInfo]
    active: str


class TestConnectionRequest(BaseModel):
    provider: str
    model: Optional[str] = None
    apiKey: Optional[str] = None


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    latencyMs: Optional[int] = None
    error: Optional[str] = None


class ProviderConfig(BaseModel):
    provider: str
    model: str
    apiKeyRef: Optional[str] = None
    apiEndpoint: Optional[str] = None


# ============================================
# Statistics Schemas
# ============================================
class StatisticsRequest(BaseModel):
    fileId: Optional[str] = None
    prices: Optional[list[float]] = None


class OpeningAnalysisRequest(BaseModel):
    fileId: Optional[str] = None
    modules: Optional[list[str]] = None
    provider: Optional[str] = "deepseek"
    model: Optional[str] = None


class StatisticsResponse(BaseModel):
    prices: list[float]
    priceRankings: list[dict]
    averagePrice: float
    lowestPrice: float
    highestPrice: float
    dispersionCoefficient: float
    priceChanges: list[float]


# ============================================
# Health Check
# ============================================
class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str = "1.0.0"


# ============================================
# Auth Schemas
# ============================================
class RegisterRequest(BaseModel):
    email: str = Field(..., description="邮箱地址（登录标识）", pattern=r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
    password: str = Field(..., min_length=6, max_length=100)
    confirm_password: str = Field(..., min_length=6, max_length=100)
    code: str = Field(..., min_length=6, max_length=6, description="邮箱验证码")
    username: Optional[str] = Field(None, min_length=2, max_length=50, description="用户名（可选，留空自动生成）")


class SendCodeRequest(BaseModel):
    email: str = Field(..., description="邮箱地址", pattern=r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="邮箱地址", pattern=r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="重置密码 token")
    new_password: str = Field(..., min_length=6, max_length=100)


class LoginRequest(BaseModel):
    email: str = Field(..., description="邮箱地址")
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str
    version: str = "1.0.0"


# ============================================
# API Key Schemas
# ============================================
class ApiKeySaveRequest(BaseModel):
    provider: str = Field(..., description="Provider 标识，如 deepseek、openai")
    api_key: str = Field(..., min_length=1, description="明文 API Key，后端 Fernet 加密存储")


class ApiKeyResponse(BaseModel):
    provider: str
    masked_key: Optional[str] = None


class ApiKeyListResponse(BaseModel):
    keys: list[ApiKeyResponse]
"""
Pydantic schemas unit tests.
"""
import pytest
from datetime import datetime

from app.models.schemas import (
    FileUploadResponse,
    FileListItem,
    FileListResponse,
    ExtractRequest,
    ElementData,
    ExtractProgress,
    ExtractElement,
    ExtractDone,
    ExtractError,
    ProviderInfo,
    ProvidersResponse,
    TestConnectionRequest,
    TestConnectionResponse,
    ProviderConfig,
    StatisticsRequest,
    StatisticsResponse,
    HealthResponse,
)


class TestFileUploadResponse:
    """Tests for FileUploadResponse schema."""

    def test_valid_response(self):
        data = {
            "id": "uuid-1",
            "name": "tender.pdf",
            "size": 1024000,
            "type": "application/pdf",
            "status": "ready",
            "createdAt": datetime.now(),
        }
        resp = FileUploadResponse(**data)
        assert resp.id == "uuid-1"
        assert resp.name == "tender.pdf"
        assert resp.status == "ready"

    def test_missing_required_field(self):
        with pytest.raises(Exception):
            FileUploadResponse(id="uuid-1")  # 缺少 name, size 等


class TestFileListItem:
    """Tests for FileListItem schema."""

    def test_valid_item(self):
        data = {
            "id": "uuid-1",
            "name": "tender.pdf",
            "size": 1024,
            "mimeType": "application/pdf",
            "category": "tender",
            "status": "ready",
            "createdAt": datetime.now(),
        }
        item = FileListItem(**data)
        assert item.category == "tender"

    def test_invalid_category_not_enforced(self):
        """Pydantic 不限制 category 字符串值，但 schema 应可接受 tender 和 bid。"""
        data = {
            "id": "uuid-1",
            "name": "bid.pdf",
            "size": 1024,
            "mimeType": "application/pdf",
            "category": "bid",
            "status": "ready",
            "createdAt": datetime.now(),
        }
        item = FileListItem(**data)
        assert item.category == "bid"


class TestExtractRequest:
    """Tests for ExtractRequest schema."""

    def test_valid_request(self):
        req = ExtractRequest(fileId="uuid-1")
        assert req.fileId == "uuid-1"
        assert req.provider == "deepseek"  # 默认值

    def test_provider_override(self):
        req = ExtractRequest(fileId="uuid-1", provider="openai")
        assert req.provider == "openai"

    def test_missing_file_id(self):
        with pytest.raises(Exception):
            ExtractRequest()  # fileId 是必填


class TestElementData:
    """Tests for ElementData schema."""

    def test_valid_element(self):
        data = ElementData(name="资质要求", content="内容...")
        assert data.name == "资质要求"
        assert data.confidence is None

    def test_with_confidence(self):
        data = ElementData(name="资质要求", content="内容...", confidence=95)
        assert data.confidence == 95


class TestExtractProgress:
    """Tests for ExtractProgress schema."""

    def test_default_type(self):
        prog = ExtractProgress(message="正在解析文件...")
        assert prog.type == "progress"


class TestProviderInfo:
    """Tests for ProviderInfo schema."""

    def test_valid_provider(self):
        provider = ProviderInfo(id="deepseek", name="DeepSeek", models=["deepseek-v4-flash"])
        assert provider.id == "deepseek"
        assert len(provider.models) == 1

    def test_missing_models(self):
        with pytest.raises(Exception):
            ProviderInfo(id="deepseek", name="DeepSeek")  # models 是必填


class TestProvidersResponse:
    """Tests for ProvidersResponse schema."""

    def test_valid_response(self):
        resp = ProvidersResponse(
            providers=[ProviderInfo(id="deepseek", name="DeepSeek", models=["deepseek-v4-flash"])],
            active="deepseek"
        )
        assert resp.active == "deepseek"
        assert len(resp.providers) == 1


class TestTestConnectionRequest:
    """Tests for TestConnectionRequest schema."""

    def test_valid_request(self):
        req = TestConnectionRequest(provider="deepseek")
        assert req.provider == "deepseek"
        assert req.apiKey is None

    def test_with_api_key(self):
        req = TestConnectionRequest(provider="openai", apiKey="sk-test")
        assert req.apiKey == "sk-test"


class TestTestConnectionResponse:
    """Tests for TestConnectionResponse schema."""

    def test_success_response(self):
        resp = TestConnectionResponse(success=True, message="连接成功", latencyMs=120)
        assert resp.success is True
        assert resp.latencyMs == 120

    def test_failure_response(self):
        resp = TestConnectionResponse(success=False, message="连接失败", error="无效 Key")
        assert resp.success is False
        assert resp.error == "无效 Key"


class TestStatisticsRequest:
    """Tests for StatisticsRequest schema."""

    def test_with_file_id(self):
        req = StatisticsRequest(fileId="uuid-1")
        assert req.fileId == "uuid-1"
        assert req.prices is None

    def test_with_prices(self):
        req = StatisticsRequest(prices=[100, 200, 150])
        assert len(req.prices) == 3
        assert req.fileId is None


class TestStatisticsResponse:
    """Tests for StatisticsResponse schema."""

    def test_valid_response(self):
        resp = StatisticsResponse(
            prices=[100, 200, 150],
            priceRankings=[{"bidderId": "bidder_1", "price": 100, "rank": 1}],
            averagePrice=150,
            lowestPrice=100,
            highestPrice=200,
            dispersionCoefficient=27.22,
            priceChanges=[10.0],
        )
        assert resp.averagePrice == 150


class TestHealthResponse:
    """Tests for HealthResponse schema."""

    def test_valid_response(self):
        resp = HealthResponse(status="healthy", timestamp=datetime.now())
        assert resp.status == "healthy"
        assert resp.version == "1.0.0"